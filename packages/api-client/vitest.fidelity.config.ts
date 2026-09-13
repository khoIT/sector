import { defineConfig } from 'vitest/config';

/**
 * `pnpm fidelity` — the replay of the production mirror through every schema.
 *
 * Separate from the unit config because it needs a database and takes
 * minutes, not milliseconds. One file at a time: the entries share a
 * connection budget on a laptop Mongo, and the report at the end is one
 * table, not several interleaved ones.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/fidelity/**/*.fidelity.test.ts'],
    testTimeout: 15 * 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    reporters: ['verbose'],
  },
});
