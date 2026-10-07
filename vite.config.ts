import { copyFile, cp, mkdir, readdir, realpath } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const runtimeDirectory = dirname(fileURLToPath(import.meta.url));
const sourceOfferUrl = process.env.VITE_SOURCE_OFFER_URL ?? '';
const sourceRevision = process.env.VITE_SOURCE_REVISION ?? '';
if (process.env.NODE_ENV === 'production') {
  const sourceUrl = URL.parse(sourceOfferUrl);
  const allowedOrigins = (process.env.VITE_ALLOWED_HOST_ORIGINS ?? '').split(',');
  if (
    !/^[0-9a-f]{40}$/.test(sourceRevision) ||
    sourceUrl?.protocol !== 'https:' ||
    !sourceUrl.href.includes(sourceRevision)
  ) {
    throw new Error(
      'VITE_SOURCE_OFFER_URL debe apuntar al código fuente versionado de este build.',
    );
  }
  if (
    allowedOrigins.length === 0 ||
    allowedOrigins.some((origin) => {
      const parsed = URL.parse(origin);
      return parsed?.protocol !== 'https:' || parsed.origin !== origin;
    })
  ) {
    throw new Error('VITE_ALLOWED_HOST_ORIGINS debe indicar orígenes HTTPS exactos del LMS.');
  }
}

const copyScratchGuiChunks = {
  name: 'copy-scratch-gui-chunks',
  apply: 'build' as const,
  async closeBundle() {
    const sourceDirectory = await realpath(
      resolve(runtimeDirectory, 'node_modules/@scratch/scratch-gui/dist/chunks'),
    );
    const destinationDirectory = resolve(runtimeDirectory, 'dist/chunks');
    const assetChunkDirectory = resolve(runtimeDirectory, 'dist/assets/chunks');
    const entries = await readdir(sourceDirectory, { withFileTypes: true });
    await mkdir(destinationDirectory, { recursive: true });
    await mkdir(assetChunkDirectory, { recursive: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && extname(entry.name) === '.js')
        .map(async (entry) => {
          const source = resolve(sourceDirectory, entry.name);
          await Promise.all([
            copyFile(source, resolve(destinationDirectory, entry.name)),
            copyFile(source, resolve(assetChunkDirectory, entry.name)),
          ]);
        }),
    );

    const guiStaticDirectory = await realpath(
      resolve(runtimeDirectory, 'node_modules/@scratch/scratch-gui/dist/static'),
    );
    await cp(
      resolve(guiStaticDirectory, 'assets'),
      resolve(runtimeDirectory, 'dist/assets/static/assets'),
      { recursive: true },
    );
    await cp(
      resolve(guiStaticDirectory, 'blocks-media'),
      resolve(runtimeDirectory, 'dist/static/blocks-media'),
      { recursive: true },
    );

    const vmDirectory = await realpath(
      resolve(runtimeDirectory, 'node_modules/@scratch/scratch-vm/dist/web'),
    );
    const vmAssets = resolve(vmDirectory, 'assets');
    const staticAssetDirectory = resolve(runtimeDirectory, 'dist/assets/static/assets');
    const workerDirectory = resolve(runtimeDirectory, 'dist/assets/static');
    const vmAssetEntries = await readdir(vmAssets, { withFileTypes: true });
    await mkdir(staticAssetDirectory, { recursive: true });
    await mkdir(workerDirectory, { recursive: true });
    await Promise.all(
      vmAssetEntries
        .filter((entry) => entry.isFile() && extname(entry.name) === '.js')
        .map((entry) =>
          copyFile(resolve(vmAssets, entry.name), resolve(staticAssetDirectory, entry.name)),
        ),
    );
    await copyFile(
      resolve(vmDirectory, 'extension-worker.js'),
      resolve(workerDirectory, 'extension-worker.js'),
    );
  },
};

export default defineConfig({
  plugins: [react(), copyScratchGuiChunks],
  base: './',
  build: {
    sourcemap: true,
    target: 'es2022',
    copyPublicDir: false,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  publicDir: false,
  define: {
    'import.meta.env.VITE_SOURCE_OFFER_URL': JSON.stringify(sourceOfferUrl),
    'import.meta.env.VITE_SOURCE_REVISION': JSON.stringify(sourceRevision || 'development'),
  },
});
