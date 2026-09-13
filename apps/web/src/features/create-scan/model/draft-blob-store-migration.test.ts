import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { migratePersistedStorage } from '@/app/storage-migration';

import { readDraft } from './draft-storage';

/**
 * The pre-rename names, written out rather than imported: the point of these
 * tests is what an upgrading browser actually holds on disk, which no constant
 * in this build can vouch for.
 */
const LEGACY_DATABASE = 'scanvault.create-scan';
const CURRENT_DATABASE = 'sector.create-scan';
const STORE = 'draft-files';

/**
 * A module that has not migrated yet.
 *
 * The copy is memoised for the life of the module, the way a page load
 * memoises it, so every test has to start from a fresh one to see it happen.
 */
async function unmigratedStore() {
  vi.resetModules();
  return import('./draft-blob-store');
}

function record(draftId: string, fileId: string, text: string) {
  return {
    id: `${draftId}:${fileId}`,
    draftId,
    fileId,
    blob: new Blob([text], { type: 'video/mp4' }),
    session: null,
  };
}

function seedDatabase(name: string, records: ReturnType<typeof record>[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('draftId', 'draftId', { unique: false });
    };
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(STORE, 'readwrite');
      for (const entry of records) transaction.objectStore(STORE).put(entry);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

async function databaseNames(): Promise<string[]> {
  const databases = await globalThis.indexedDB.databases();
  return databases
    .map((database) => database.name)
    .filter((name) => name !== undefined)
    .sort();
}

async function textOf(value: Blob): Promise<string> {
  return typeof value.text === 'function' ? value.text() : '';
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the database the old name held', () => {
  it("carries an unfinished upload's bytes across and drops the old database", async () => {
    await seedDatabase(LEGACY_DATABASE, [
      record('draft-1', 'file-a', 'first clip'),
      record('draft-1', 'file-b', 'second clip'),
    ]);

    const store = await unmigratedStore();
    const records = await store.readDraftFiles('draft-1');

    expect(records.map((entry) => entry.fileId).sort()).toEqual(['file-a', 'file-b']);
    expect(await textOf(records[0]!.blob)).toBe('first clip');
    expect(await databaseNames()).toEqual([CURRENT_DATABASE]);
  });

  it('leaves nothing behind when the browser never ran the old build', async () => {
    // `open` creates what it cannot find, so a careless check would leave an
    // empty scanvault database on nearly every machine.
    const store = await unmigratedStore();
    await store.putDraftFile('draft-1', 'file-a', new Blob(['fresh']));

    expect(await databaseNames()).toEqual([CURRENT_DATABASE]);
  });

  it('loses nothing when it runs a second time', async () => {
    await seedDatabase(LEGACY_DATABASE, [record('draft-1', 'file-a', 'kept')]);

    const first = await unmigratedStore();
    await first.readDraftFiles('draft-1');

    // A second load, with the old database already gone.
    const second = await unmigratedStore();
    const records = await second.readDraftFiles('draft-1');

    expect(records).toHaveLength(1);
    expect(await textOf(records[0]!.blob)).toBe('kept');
    expect(await databaseNames()).toEqual([CURRENT_DATABASE]);
  });

  it('keeps the record already under the new name', async () => {
    // Same draft, same file, written since the upgrade: the copy must not put
    // the older bytes back over it.
    await seedDatabase(LEGACY_DATABASE, [record('draft-1', 'file-a', 'before the rename')]);
    await seedDatabase(CURRENT_DATABASE, [record('draft-1', 'file-a', 'written since')]);

    const store = await unmigratedStore();
    const records = await store.readDraftFiles('draft-1');

    expect(records).toHaveLength(1);
    expect(await textOf(records[0]!.blob)).toBe('written since');
  });

  it('keeps the old database when the bytes could not be written across', async () => {
    // The old database holds the only copy. A copy that wrote nothing — a full
    // quota, or the new database blocked by another tab mid-upgrade — must
    // leave it for the next load to retry, not delete it on the strength of a
    // swallowed error.
    await seedDatabase(LEGACY_DATABASE, [record('draft-1', 'file-a', 'irreplaceable')]);

    const realOpen = globalThis.indexedDB.open.bind(globalThis.indexedDB);
    vi.spyOn(globalThis.indexedDB, 'open').mockImplementation(((name: string, version?: number) => {
      if (name !== CURRENT_DATABASE) {
        return version === undefined ? realOpen(name) : realOpen(name, version);
      }
      const blocked: Record<string, unknown> = {};
      queueMicrotask(() => (blocked.onblocked as (() => void) | undefined)?.());
      return blocked as unknown as IDBOpenDBRequest;
    }) as typeof globalThis.indexedDB.open);

    const store = await unmigratedStore();
    await store.readDraftFiles('draft-1');

    expect(await databaseNames()).toContain(LEGACY_DATABASE);
  });

  it('is a no-op where IndexedDB is refused outright', async () => {
    // @ts-expect-error deliberately removing the global under test
    globalThis.indexedDB = undefined;
    const store = await unmigratedStore();

    await expect(store.readDraftFiles('draft-1')).resolves.toEqual([]);
    await expect(store.putDraftFile('draft-1', 'file-a', new Blob(['a']))).resolves.toBe(false);
  });
});

describe('a populated pre-rename draft', () => {
  it('opens after the upgrade with its manifest and its bytes intact', async () => {
    // The whole point of both migrations, in one place: a learner who left a
    // study half-uploaded before the rename must find it exactly as it was.
    const draftId = '6aa42b45e7e36ea28c4e73d9';
    const manifest = JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      draftId,
      step: 'study',
      files: [
        {
          id: 'file-a',
          name: 'AAA-long.mp4',
          size: 4_211_004,
          type: 'video/mp4',
          storageKey: null,
          confidence: null,
        },
      ],
      scanTypeId: '69e7d0456d1cfa1d40770e06',
      scanTypeName: 'AAA',
      organizationId: '68d3449adbae8462f01f68e5',
      findings: { v5_aaa_long_lvl1: '≤ 3cm' },
      note: 'Poor window, obese habitus.',
      scanIdentifier: 'SESSION-4',
      externalPatientId: '',
      groupIds: ['g1'],
      expertReview: null,
      scanId: null,
    });

    const entries = new Map<string, string>([['scanvault.create-scan.draft', manifest]]);
    const localStorage = {
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
    };
    vi.stubGlobal('window', { localStorage });
    await seedDatabase(LEGACY_DATABASE, [
      record(draftId, 'file-a', 'the clip that was still uploading'),
    ]);

    migratePersistedStorage(localStorage);
    const store = await unmigratedStore();
    const files = await store.readDraftFiles(draftId);

    const draft = readDraft();
    expect(draft?.draftId).toBe(draftId);
    expect(draft?.note).toBe('Poor window, obese habitus.');
    expect(draft?.files).toHaveLength(1);
    expect(files).toHaveLength(1);
    expect(await textOf(files[0]!.blob)).toBe('the clip that was still uploading');

    // And nothing is left under either old name.
    expect(localStorage.getItem('scanvault.create-scan.draft')).toBeNull();
    expect(await databaseNames()).toEqual([CURRENT_DATABASE]);
  });
});
