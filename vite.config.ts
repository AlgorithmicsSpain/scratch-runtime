import { copyFile, mkdir, readdir, realpath } from 'node:fs/promises';
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
    const destinationDirectory = resolve(runtimeDirectory, 'dist/assets/chunks');
    const entries = await readdir(sourceDirectory, { withFileTypes: true });
    await mkdir(destinationDirectory, { recursive: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && extname(entry.name) === '.js')
        .map((entry) =>
          copyFile(
            resolve(sourceDirectory, entry.name),
            resolve(destinationDirectory, entry.name),
          ),
        ),
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
