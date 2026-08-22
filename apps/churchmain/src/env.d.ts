/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SANITY_PROJECT_ID?: string;
  readonly PUBLIC_SANITY_DATASET?: string;
  readonly SANITY_API_READ_TOKEN?: string;
  readonly VERCEL_ENV?: "development" | "preview" | "production";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
