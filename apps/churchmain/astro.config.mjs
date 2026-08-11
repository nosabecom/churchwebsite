// @ts-check
import { defineConfig } from "astro/config";
import sanity from "@sanity/astro";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";

const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET } = loadEnv(
  process.env.NODE_ENV ?? "development",
  process.cwd(),
  "",
);

const projectId = PUBLIC_SANITY_PROJECT_ID || "qd5xjyx2";
const dataset = PUBLIC_SANITY_DATASET || "production";

// https://astro.build/config
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 4321,
  },

  vite: {
    plugins: [tailwindcss()],
    server: {
      strictPort: true,
    },
  },

  integrations: [
    sanity({
      projectId,
      dataset,
      useCdn: false,
    }),
  ],
});
