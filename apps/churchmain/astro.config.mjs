// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import sanity from '@sanity/astro';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 4321
  },

  vite: {
    plugins: [tailwindcss()],
    server: {
      strictPort: true
    }
  },

  integrations: [sanity(), react()]
});