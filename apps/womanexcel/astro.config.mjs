// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 1234,
  },

  vite: {
    plugins: [tailwindcss()],
    server: {
      strictPort: true,
    },
  },
});
