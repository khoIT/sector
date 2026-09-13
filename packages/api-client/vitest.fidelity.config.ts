import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * `.env.local` at the repository root, for the two values the route replay
 * needs and nobody should have to export by hand: the mirror API's JWT secret
 * and the seeded accounts' password. Only keys the shell has not already set,
 * so an explicit environment still wins. Gitignored, never committed.
 */
function loadLocalEnv(): void {
  const path = fileURLToPath(new URL('../../.env.local', import.meta.url));
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trimStart().startsWith('#')) continue;
    const [, key, value] = match;
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadLocalEnv();

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
