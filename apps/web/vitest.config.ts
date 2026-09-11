import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Node environment, not jsdom: everything tested here is pure — route guards,
 * permission-to-tab mapping, nav visibility and display formatters. Rendering
 * components would need jsdom and a DOM testing library; nothing here does.
 *
 * The `@` alias has to be restated because vitest does not read vite.config.ts
 * when a vitest.config.ts is present.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
