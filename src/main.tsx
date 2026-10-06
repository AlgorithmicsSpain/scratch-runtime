import ScratchGUI, { AppStateHOC, legacyConfig } from '@scratch/scratch-gui';
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';

import {
  isHostMessage,
  MAX_PROJECT_BYTES,
  PROTOCOL_VERSION,
  type HostMessage,
  type RuntimeMessage,
} from './protocol';
import './styles.css';

const sourceOfferUrl = import.meta.env.VITE_SOURCE_OFFER_URL;
const sourceRevision = import.meta.env.VITE_SOURCE_REVISION;
const allowedHosts = (
  import.meta.env.VITE_ALLOWED_HOST_ORIGINS ||
  (import.meta.env.DEV ? 'http://localhost:3000,http://127.0.0.1:3000' : '')
)
  .split(',')
  .map((origin: string) => origin.trim())
  .filter((origin: string) => {
    try {
      const parsed = new URL(origin);
      return (
        parsed.origin === origin &&
        (parsed.protocol === 'https:' ||
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1')
      );
    } catch {
      return false;
    }
  });

interface EditorProps {
  projectId: string;
  canChangeLanguage: boolean;
  canEditTitle: boolean;
  canSave: boolean;
  canManageFiles: boolean;
  backpackVisible: boolean;
  isEmbedded: boolean;
  onVmInit: (runtime: ScratchVM) => void;
  onProjectLoaded: () => void;
  showTelemetryModal: boolean;
  canUseCloud: boolean;
  enableCommunity: boolean;
  onExtensionButtonClick: () => void;
}

interface ScratchVM {
  extensionManager: { loadExtensionURL: (id: string) => Promise<unknown> };
  loadProject: (project: ArrayBuffer) => Promise<void>;
  saveProjectSb3: () => Promise<Blob>;
  on: (event: string, listener: () => void) => void;
  removeListener: (event: string, listener: () => void) => void;
}

legacyConfig.storage.saveProject = async () =>
  Promise.reject(new Error('El guardado se gestiona desde Project LAB.'));
delete legacyConfig.storage.cloudVariables;
delete legacyConfig.storage.backpackStorage;
const wrapEditor = AppStateHOC as unknown as (
  component: ComponentType<EditorProps>,
  localesOnly: boolean,
  configFactory: () => typeof legacyConfig,
) => ComponentType<EditorProps>;
// The published Scratch GUI is a CommonJS bundle. Vite wraps its exports as
// `default`, so the imported default is the module object rather than GUI.
const GUI =
  (ScratchGUI as unknown as { default?: ComponentType<EditorProps> }).default ??
  (ScratchGUI as ComponentType<EditorProps>);
const ScratchEditor = wrapEditor(GUI, false, () => legacyConfig);

function Runtime() {
  const [host, setHost] = useState<{ origin: string; channel: string } | null>(null);
  const hostRef = useRef<{ origin: string; channel: string } | null>(null);
  const [vm, setVm] = useState<ScratchVM | null>(null);
  const vmReady = useRef(false);
  const loadingProject = useRef(false);
  const [title, setTitle] = useState('Proyecto Scratch');
  const [error, setError] = useState<string | null>(null);
  const pendingInit = useRef<Extract<HostMessage, { type: 'HOST_INIT' }> | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const send = useCallback((message: RuntimeMessage, transfer: Transferable[] = []) => {
    if (hostRef.current === null || window.parent === window) return;
    window.parent.postMessage(message, hostRef.current.origin, transfer);
  }, []);

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (
        event.source !== window.parent ||
        !allowedHosts.includes(event.origin) ||
        !isHostMessage(event.data)
      )
        return;
      if (host !== null && event.data.channel !== host.channel) return;
      if (event.data.type === 'HOST_INIT') {
        if (event.data.project !== null && event.data.project.byteLength > MAX_PROJECT_BYTES) {
          setError('El proyecto supera el tamaño permitido.');
          return;
        }
        pendingInit.current = event.data;
        hostRef.current = { origin: event.origin, channel: event.data.channel };
        setHost(hostRef.current);
        setTitle(event.data.title);
        setError(null);
        if (vm !== null && vmReady.current) void loadProject(vm, event.data.project, event.origin);
      } else if (vm !== null) {
        void saveProject(vm);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [host, vm]);

  const loadProject = async (runtime: ScratchVM, bytes: ArrayBuffer | null, origin: string) => {
    try {
      const pending = pendingInit.current;
      if (pending === null) return;
      pendingInit.current = null;
      loadingProject.current = true;
      if (bytes !== null) await runtime.loadProject(bytes);
      loadingProject.current = false;
      window.parent.postMessage(
        { type: 'RUNTIME_READY', version: PROTOCOL_VERSION, channel: pending.channel },
        origin,
      );
      if (bytes === null) void saveProject(runtime);
    } catch {
      loadingProject.current = false;
      setError('No se pudo abrir el proyecto Scratch.');
      window.parent.postMessage(
        {
          type: 'RUNTIME_ERROR',
          version: PROTOCOL_VERSION,
          channel: hostRef.current?.channel ?? '',
          message: 'No se pudo abrir el proyecto Scratch.',
        },
        origin,
      );
    }
  };

  const saveProject = (runtime: ScratchVM): Promise<void> => {
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const blob = await runtime.saveProjectSb3();
        if (blob.size > MAX_PROJECT_BYTES)
          throw new Error('El proyecto supera el tamaño permitido.');
        const buffer = await blob.arrayBuffer();
        send(
          {
            type: 'PROJECT_SAVE',
            version: PROTOCOL_VERSION,
            channel: hostRef.current?.channel ?? '',
            project: buffer,
          },
          [buffer],
        );
      } catch {
        setError(
          'No se pudo guardar el proyecto. Reduce el tamaño de sus imágenes o sonidos e inténtalo de nuevo.',
        );
      }
    });
    return saveQueue.current;
  };

  const onVmInit = useCallback(
    (runtime: ScratchVM) => {
      runtime.extensionManager.loadExtensionURL = () =>
        Promise.reject(new Error('No se cargan extensiones externas.'));
      setVm(runtime);
      const initial = pendingInit.current;
      if (initial !== null && vmReady.current && host !== null)
        void loadProject(runtime, initial.project, host.origin);
    },
    [host],
  );

  const onProjectLoaded = useCallback(() => {
    vmReady.current = true;
    const initial = pendingInit.current;
    if (initial !== null && vm !== null && host !== null)
      void loadProject(vm, initial.project, host.origin);
  }, [vm, host]);

  useEffect(() => {
    const initial = pendingInit.current;
    if (initial !== null && vm !== null && vmReady.current && host !== null)
      void loadProject(vm, initial.project, host.origin);
  }, [vm, host]);

  useEffect(() => {
    if (vm === null) return;
    const changed = () => {
      window.clearTimeout(saveTimer.current);
      if (!loadingProject.current && vmReady.current && host !== null)
        saveTimer.current = window.setTimeout(() => void saveProject(vm), 1500);
    };
    vm.on('PROJECT_CHANGED', changed);
    return () => {
      window.clearTimeout(saveTimer.current);
      vm.removeListener('PROJECT_CHANGED', changed);
    };
  }, [vm, host]);

  return (
    <>
      <header className="runtime-bar">
        <strong title={title}>{title}</strong>
        <button
          disabled={vm === null}
          onClick={() => vm !== null && void saveProject(vm)}
          type="button"
        >
          Guardar
        </button>
        <a
          href={sourceOfferUrl || 'https://www.gnu.org/licenses/agpl-3.0.html'}
          rel="noreferrer"
          target="_blank"
          title={`Código fuente de la revisión ${sourceRevision}`}
        >
          Licencia AGPL y código fuente
        </a>
      </header>
      {error !== null && (
        <p className="runtime-error" role="alert">
          {error}
        </p>
      )}
      <ScratchEditor
        projectId="0"
        canChangeLanguage
        canEditTitle={false}
        canSave={false}
        canManageFiles={false}
        backpackVisible={false}
        isEmbedded
        onVmInit={onVmInit}
        onProjectLoaded={onProjectLoaded}
        showTelemetryModal={false}
        canUseCloud={false}
        enableCommunity={false}
        onExtensionButtonClick={() =>
          setError('Las extensiones externas están desactivadas por seguridad.')
        }
      />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Runtime />);
