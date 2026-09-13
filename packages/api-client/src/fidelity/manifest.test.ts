import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { NOT_REPLAYED, REPLAY_ENTRIES } from './manifest';

/**
 * The guard: a schema without a fidelity decision fails the ordinary unit run.
 *
 * Read from the source files rather than from the barrel, so a schema that is
 * exported from its module but forgotten in index.ts is still caught, and so
 * this cannot be satisfied by importing less.
 */
const SCHEMAS_DIR = fileURLToPath(new URL('../schemas/', import.meta.url));
const EXPORTED_SCHEMA = /export const ([a-zA-Z0-9]+Schema)\b/g;

function exportedSchemaNames(): Map<string, string> {
  const names = new Map<string, string>();
  for (const file of readdirSync(SCHEMAS_DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
    const source = readFileSync(join(SCHEMAS_DIR, file), 'utf8');
    for (const match of source.matchAll(EXPORTED_SCHEMA)) {
      names.set(match[1] as string, file);
    }
  }
  return names;
}

const proved = new Set(REPLAY_ENTRIES.flatMap((entry) => entry.proves));
const excused = new Set(Object.keys(NOT_REPLAYED));

describe('every exported schema has a fidelity decision', () => {
  const exported = exportedSchemaNames();

  it('finds the schemas at all', () => {
    expect(exported.size).toBeGreaterThan(50);
    expect(exported.get('scanSchema')).toBe('scan.ts');
  });

  it('replays or excuses each one', () => {
    const undecided = [...exported]
      .filter(([name]) => !proved.has(name) && !excused.has(name))
      .map(([name, file]) => `${name} (${file})`);
    expect(undecided).toEqual([]);
  });

  it('names only schemas that exist', () => {
    const unknown = [...proved, ...excused].filter((name) => !exported.has(name));
    expect(unknown).toEqual([]);
  });

  it('never both replays and excuses a schema', () => {
    expect([...proved].filter((name) => excused.has(name))).toEqual([]);
  });

  it('gives every excuse a reason', () => {
    for (const [name, reason] of Object.entries(NOT_REPLAYED)) {
      expect(reason.length, name).toBeGreaterThan(10);
    }
  });

  it('gives every entry a distinct name and a real collection', () => {
    const names = REPLAY_ENTRIES.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    for (const entry of REPLAY_ENTRIES) {
      expect(entry.collection).toMatch(/^[a-z0-9]+$/);
      expect(entry.proves.length).toBeGreaterThan(0);
    }
  });
});
