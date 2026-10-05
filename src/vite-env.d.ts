/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALLOWED_HOST_ORIGINS: string;
  readonly VITE_SOURCE_OFFER_URL: string;
  readonly VITE_SOURCE_REVISION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
