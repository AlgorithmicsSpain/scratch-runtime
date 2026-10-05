import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

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

export default defineConfig({
  plugins: [react()],
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
