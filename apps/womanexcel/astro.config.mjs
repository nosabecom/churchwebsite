// @ts-check
import { createSanityDevReloadPlugin } from "@churchwebsite/newsletters";
import { createClient } from "@sanity/client";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const env = loadEnv(process.env.NODE_ENV ?? "development", repositoryRoot, "");
const projectId = env.PUBLIC_SANITY_PROJECT_ID;
const dataset = env.PUBLIC_SANITY_DATASET;
const watchDevelopment = Boolean(projectId) && dataset === "development";
const client = watchDevelopment
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2026-08-13",
      useCdn: false,
      token: env.SANITY_API_READ_TOKEN || undefined,
    })
  : undefined;

// https://astro.build/config
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 1234,
  },

  vite: {
    envDir: repositoryRoot,
    plugins: [
      tailwindcss(),
      createSanityDevReloadPlugin({
        enabled: watchDevelopment,
        client,
        query:
          '*[_type == "newsletterIssue" && site == $site && !(_id in path("drafts.**"))]',
        params: { site: "womanExcel" },
        label: "Woman Excel",
      }),
    ],
    server: {
      strictPort: true,
    },
  },
});
