import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSessionStore } from '@sector/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DRAFT_BLOB_DATABASE } from '@/features/create-scan/model/draft-blob-store';

import {
  legacyNameFor,
  migratePersistedStorage,
  PERSISTED_KEYS,
  STORAGE_NAMESPACE,
} from './storage-migration';

function fakeStorage(seed: Record<string, string> = {}) {
  const entries = new Map<string, string>(Object.entries(seed));

  return {
    get length(): number {
      return entries.size;
    },
    key: (index: number): string | null => [...entries.keys()][index] ?? null,
    getItem: (key: string): string | null => entries.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      entries.set(key, value);
    },
    removeItem: (key: string): void => {
      entries.delete(key);
    },
    snapshot: (): Record<string, string> => Object.fromEntries(entries),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('moving one key out of the pre-rename namespace', () => {
  it.each(PERSISTED_KEYS.filter((key) => key.shape === 'exact').map((key) => key.name))(
    '%s arrives under its new name and leaves no old one',
    (name) => {
      const storage = fakeStorage({ [legacyNameFor(name)]: 'kept' });

      migratePersistedStorage(storage);

      expect(storage.getItem(name)).toBe('kept');
      expect(storage.getItem(legacyNameFor(name))).toBeNull();
    },
  );

  it('moves every member of a per-user family, not just a name it could guess', () => {
    const storage = fakeStorage({
      'scanvault.review-draft.scan-1': '{"note":"one"}',
      'scanvault.review-draft.scan-2': '{"note":"two"}',
      'scanvault.scan-list.last-tab.user-1': 'my-scans',
      'scanvault.scan-list.columns.user-1.my-scans': '["outcome"]',
      'scanvault.scan-list.columns.user-2.group-unreviewed': '["tags"]',
    });

    migratePersistedStorage(storage);

    expect(storage.snapshot()).toEqual({
      'sector.review-draft.scan-1': '{"note":"one"}',
      'sector.review-draft.scan-2': '{"note":"two"}',
      'sector.scan-list.last-tab.user-1': 'my-scans',
      'sector.scan-list.columns.user-1.my-scans': '["outcome"]',
      'sector.scan-list.columns.user-2.group-unreviewed': '["tags"]',
    });
  });

  it('leaves keys outside the namespace alone', () => {
    // `language` matches the legacy dashboard deliberately, and a stray legacy
    // token is not this sweep's to touch.
    const storage = fakeStorage({ language: 'fr', token: 'legacy' });

    migratePersistedStorage(storage);

    expect(storage.snapshot()).toEqual({ language: 'fr', token: 'legacy' });
  });
});

describe('what the sweep must never destroy', () => {
  it('keeps the value already under the new name and drops the stale one', () => {
    const storage = fakeStorage({
      'scanvault.theme': 'dark',
      'sector.theme': 'light',
    });

    migratePersistedStorage(storage);

    expect(storage.getItem('sector.theme')).toBe('light');
    expect(storage.getItem('scanvault.theme')).toBeNull();
  });

  it('keeps the old copy when the write fails, rather than deleting the only one', () => {
    // A full or blocked store must cost nothing: the key is tried again on the
    // next load, where it may well succeed.
    const storage = {
      ...fakeStorage({ 'scanvault.session': '{"token":"t"}' }),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    expect(() => migratePersistedStorage(storage)).not.toThrow();
    expect(storage.getItem('scanvault.session')).toBe('{"token":"t"}');
  });

  it('changes nothing on a second run, and leaves what was written since', () => {
    const storage = fakeStorage({
      'scanvault.create-scan.draft': '{"version":1}',
    });

    migratePersistedStorage(storage);
    const afterFirst = storage.snapshot();
    storage.setItem('sector.review-draft.scan-9', '{"note":"written since"}');

    migratePersistedStorage(storage);

    expect(storage.snapshot()).toEqual({
      ...afterFirst,
      'sector.review-draft.scan-9': '{"note":"written since"}',
    });
  });

  it('survives a storage that throws on every access, as a private window does', () => {
    const hostile = {
      get length(): number {
        throw new Error('SecurityError');
      },
      key: () => {
        throw new Error('SecurityError');
      },
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };

    expect(() => migratePersistedStorage(hostile)).not.toThrow();
  });

  it('survives having no storage at all', () => {
    expect(() => migratePersistedStorage(null)).not.toThrow();
  });
});

describe('a session written before the rename', () => {
  it('still signs the user in, through the real read path', () => {
    // The sweep is what stands between an upgrade and 3,151 people being
    // bounced to the login screen with no explanation.
    const storage = fakeStorage({
      'scanvault.session': JSON.stringify({
        token: 'still-valid',
        user: { id: 'u1' },
      }),
    });
    vi.stubGlobal('window', { localStorage: storage });

    migratePersistedStorage();

    expect(createSessionStore().getToken()).toBe('still-valid');
    expect(storage.getItem('scanvault.session')).toBeNull();
  });
});

/**
 * The guard against the next key being forgotten.
 *
 * A key added to a store without an entry here would work perfectly in
 * development and silently lose whatever the previous name held on the upgrade
 * that renamed it. The names are read out of the workspace source rather than
 * from the table itself, so the two cannot drift.
 */
const WORKSPACE_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SOURCE_ROOTS = ['apps/web/src', 'packages/ui/src', 'packages/api-client/src'];
const QUOTED_NAME = /['"`]sector\.[^'"`]*['"`]/g;

/** Every `sector.` name written in shipped source, and where it was found. */
function persistedNamesInSource(): Map<string, string[]> {
  const found = new Map<string, string[]>();

  for (const root of SOURCE_ROOTS) {
    const directory = join(WORKSPACE_ROOT, root);
    for (const entry of readdirSync(directory, {
      recursive: true,
      encoding: 'utf8',
    })) {
      // Tests are not storage: they pin key literals on purpose.
      if (!/\.tsx?$/.test(entry) || entry.includes('.test.')) continue;

      const source = readFileSync(join(directory, entry), 'utf8');
      for (const match of source.matchAll(QUOTED_NAME)) {
        const name = match[0].slice(1, -1);
        found.set(name, [...(found.get(name) ?? []), `${root}/${entry}`]);
      }
    }
  }

  return found;
}

const declaredNames = new Set([
  STORAGE_NAMESPACE,
  // Not a localStorage key and so not in the table, but persisted all the same:
  // it migrates itself, inside the module that owns it.
  DRAFT_BLOB_DATABASE,
  ...PERSISTED_KEYS.map((key) => key.name),
]);

describe('every persisted name is accounted for', () => {
  it('finds the names in the source at all', () => {
    // A scan that matched nothing would pass both checks below while proving
    // nothing whatsoever.
    const found = persistedNamesInSource();

    expect(found.get('sector.session')).toEqual(['packages/api-client/src/session-store.ts']);
    expect(found.size).toBeGreaterThanOrEqual(declaredNames.size);
  });

  it('has a migration entry for each one', () => {
    const undeclared = [...persistedNamesInSource()]
      .filter(([name]) => !declaredNames.has(name))
      .map(([name, files]) => `${name} (${files.join(', ')})`);

    expect(undeclared).toEqual([]);
  });

  it('declares nothing the app has stopped using', () => {
    const found = persistedNamesInSource();
    const unused = [...declaredNames].filter((name) => !found.has(name));

    expect(unused).toEqual([]);
  });
});
