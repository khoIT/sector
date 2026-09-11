import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** The legacy GUSI API this app reads from. */
const LEGACY_API_ORIGIN = 'http://localhost:5001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3100,
    // Fail loudly rather than silently moving to 3101, so the documented port
    // is always the real one.
    strictPort: true,
    proxy: {
      // Same-origin /api keeps the API client's baseUrl empty and sidesteps
      // CORS entirely in development.
      '/api': {
        target: LEGACY_API_ORIGIN,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3100,
    strictPort: true,
  },
});
