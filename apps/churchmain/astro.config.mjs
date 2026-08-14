// @ts-check
import { createSanityDevReloadPlugin } from "@churchwebsite/newsletters";
import { createClient } from "@sanity/client";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
const projectId = env.PUBLIC_SANITY_PROJECT_ID;
const dataset = env.PUBLIC_SANITY_DATASET;
const newslettersEnabled = env.PUBLIC_SANITY_NEWSLETTERS_ENABLED === "true";
const watchDevelopment =
  newslettersEnabled && Boolean(projectId) && dataset === "development";
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
    port: 4321,
  },

  vite: {
    plugins: [
      tailwindcss(),
      createSanityDevReloadPlugin({
        enabled: watchDevelopment,
        client,
        query:
          '*[_type == "newsletterIssue" && site == $site && !(_id in path("drafts.**"))]',
        params: { site: "churchMain" },
        label: "Church Main",
      }),
    ],
    server: {
      strictPort: true,
    },
  },
});
