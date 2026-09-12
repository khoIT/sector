import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { mediaProxyPlugin } from './vite-media-proxy';

/** The legacy GUSI API this app reads from. */
const LEGACY_API_ORIGIN = 'http://localhost:5001';

/**
 * The commit the bundle was built from, shown in the account menu.
 *
 * A package version does not move between releases, so it cannot identify the
 * build a bug report came from; the commit can. Builds happen outside a git
 * checkout often enough — a Docker layer, a released tarball — that this must
 * degrade rather than fail.
 */
function buildCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify(buildCommit()),
  },
  plugins: [react(), tailwindcss(), mediaProxyPlugin()],
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
