import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { mediaProxyPlugin } from './vite-media-proxy';

/**
 * The legacy GUSI API this app reads from.
 *
 * Overridable so a second dev server can be pointed at a second API — the one
 * that serves the production mirror on :5002 — without touching this file or
 * the running :5001 instance. Read at config time, not via VITE_*, because it
 * configures the proxy rather than the bundle.
 */
const LEGACY_API_ORIGIN = process.env.SECTOR_API_ORIGIN ?? 'http://localhost:5001';

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

/**
 * Same-origin `/api` keeps the API client's baseUrl empty and sidesteps CORS
 * entirely. The preview server needs it as much as the dev server does: a
 * preview of the built bundle with no proxy cannot reach the API at all, so
 * every page renders its error state. Shared rather than restated so the two
 * cannot drift.
 */
const apiProxy = {
  '/api': {
    target: LEGACY_API_ORIGIN,
    changeOrigin: true,
  },
};

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
    proxy: apiProxy,
  },
  preview: {
    port: 3100,
    strictPort: true,
    proxy: apiProxy,
  },
});
