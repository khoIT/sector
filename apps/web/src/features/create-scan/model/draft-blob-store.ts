import type { MultipartSession } from '@sector/api-client';

/**
 * The bytes of an unfinished upload, and where its multipart transfer got to.
 *
 * A reload used to cost every file that had not finished. The manifest survives
 * — it is small and synchronous and `localStorage` holds it fine — but
 * `localStorage` holds STRINGS, so the `Blob` did not, and each unfinished file
 * came back `detached` with the learner asked to choose it again.
 *
 * Two stores, one draft: the manifest stays where it is and is the index; the
 * payload lives here. Keyed by `draftId`, so two create-scan tabs are
 * independent rather than overwriting each other.
 *
 * ## Quota
 *
 * A 200 MB study against an origin quota is not free, so a blob is written only
 * while its file is unfinished and dropped the moment the upload completes —
 * the S3 key replaces it. The peak is the in-flight set, not the study.
 *
 * ## Failure
 *
 * Every call resolves rather than rejects. IndexedDB is genuinely unavailable
 * in some private modes and genuinely full sometimes, and neither is a reason
 * to break the page: the app simply degrades to the old behaviour of asking for
 * the file again.
 */

export const DRAFT_BLOB_DATABASE = 'sector.create-scan';
const STORE = 'draft-files';
const VERSION = 1;

export type StoredDraftFile = {
  /** Composite key: one draft's file. */
  id: string;
  draftId: string;
  fileId: string;
  blob: Blob;
  /** Where the multipart transfer got to, if it had started. */
  session: MultipartSession | null;
};

function open(version?: number): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      if (!globalThis.indexedDB) return resolve(null);
      request =
        version === undefined
          ? globalThis.indexedDB.open(DRAFT_BLOB_DATABASE)
          : globalThis.indexedDB.open(DRAFT_BLOB_DATABASE, version);
    } catch {
      return resolve(null);
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: 'id' });
        // Read is always "everything for this draft", never "this one file".
        store.createIndex('draftId', 'draftId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/**
 * Open, and create the object store if a database exists without it.
 *
 * `onupgradeneeded` only fires on a version CHANGE, so a database created at
 * this version by anything that did not make the store leaves every call here
 * throwing and swallowing forever — working by the letter and doing nothing.
 * Reopening one version higher forces the upgrade and repairs it.
 *
 * Opening with no version first means the bump is relative to whatever is
 * actually there, rather than to a constant this build happens to hold.
 */
async function openDatabase(): Promise<IDBDatabase | null> {
  const database = await open();
  if (!database) return null;
  if (database.objectStoreNames.contains(STORE)) return database;

  const version = database.version;
  database.close();
  const repaired = await open(Math.max(version, VERSION) + 1);
  if (!repaired) return null;
  if (!repaired.objectStoreNames.contains(STORE)) {
    repaired.close();
    return null;
  }
  return repaired;
}

function keyFor(draftId: string, fileId: string): string {
  return `${draftId}:${fileId}`;
}

/**
 * The database this store had before the product was named Sector.
 *
 * IndexedDB has no rename, so a browser holding an unfinished study under the
 * old name has to have its records copied across and the old database dropped.
 * That cannot ride along with the app's synchronous localStorage sweep — this
 * is asynchronous — and it must finish before anything reads the new database,
 * or a resume would find an empty store and tell the learner their clips are
 * gone. Gating it inside the module that owns the database is what guarantees
 * the ordering; it runs on the first draft-file call rather than at boot, so a
 * browser that never opens Create Scan never pays for it.
 */
const LEGACY_DATABASE = 'scanvault.create-scan';

let legacyMigration: Promise<void> | null = null;

/**
 * Open the old database, but only if it is actually there.
 *
 * `open` creates whatever it cannot find, so merely looking would leave an
 * empty `scanvault.create-scan` behind on every browser that never ran the old
 * build — which is nearly all of them. Aborting the upgrade transaction that
 * would have created it rolls the creation back, and the abort surfaces as an
 * open error, so "not there" and "cannot be read" arrive as the same null.
 */
function openLegacyDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      if (!globalThis.indexedDB) return resolve(null);
      request = globalThis.indexedDB.open(LEGACY_DATABASE);
    } catch {
      return resolve(null);
    }

    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) request.transaction?.abort();
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/**
 * The old records, or `null` when they could not be read at all.
 *
 * The difference matters: an empty store has nothing to lose and the old
 * database can go, whereas a store that refused to open still holds the only
 * copy of someone's bytes and must be left exactly where it is.
 */
function readLegacyRecords(database: IDBDatabase): Promise<StoredDraftFile[] | null> {
  return new Promise((resolve) => {
    let request: IDBRequest<StoredDraftFile[]>;
    try {
      request = database.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    } catch {
      return resolve(null);
    }

    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => resolve(null);
  });
}

function deleteLegacyDatabase(): Promise<void> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      if (!globalThis.indexedDB) return resolve();
      request = globalThis.indexedDB.deleteDatabase(LEGACY_DATABASE);
    } catch {
      return resolve();
    }

    // A delete that is blocked by another tab's open connection is left for
    // the next load: the copy has already happened, so the only cost is that
    // the old database lingers one session longer.
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

async function copyLegacyRecords(): Promise<void> {
  const legacy = await openLegacyDatabase();
  if (!legacy) return;

  const records = legacy.objectStoreNames.contains(STORE) ? await readLegacyRecords(legacy) : [];
  legacy.close();
  if (!records) return;

  let arrived = 0;
  for (const record of records) {
    // `add` rather than `put`: a record already sitting under the new name was
    // written after the upgrade and is the newer one, and the duplicate-key
    // failure that protects it is the intended outcome.
    await runOnStore('readwrite', (store) => store.add(record), undefined);

    // Then count, because runOnStore swallows every failure into the same
    // resolved fallback: that intended duplicate-key refusal is indistinguishable
    // from a full quota, or from a new database another tab is blocking. Only
    // the presence of the id says the bytes are safely on the other side.
    arrived += await runOnStore('readonly', (store) => store.count(record.id), 0);
  }

  // The old database is the only other copy, so it goes only when every record
  // is provably across. A partial copy leaves it for the next load to retry,
  // which costs a lingering database and saves a learner's unfinished study.
  if (arrived === records.length) await deleteLegacyDatabase();
}

/** Copy once per page load, whatever calls first. */
function migrateLegacyDatabase(): Promise<void> {
  // Every call in this module resolves rather than rejects, and a migration
  // that somehow threw must not take the upload pump with it.
  legacyMigration ??= copyLegacyRecords().catch(() => undefined);
  return legacyMigration;
}

/** Run one transaction, resolving to `fallback` on any failure. */
async function runOnStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
  fallback: T,
): Promise<T> {
  const database = await openDatabase();
  if (!database) return fallback;

  return new Promise<T>((resolve) => {
    let request: IDBRequest;
    try {
      request = run(database.transaction(STORE, mode).objectStore(STORE));
    } catch {
      database.close();
      return resolve(fallback);
    }

    request.onsuccess = () => {
      database.close();
      resolve((request.result as T) ?? fallback);
    };
    request.onerror = () => {
      database.close();
      resolve(fallback);
    };
  });
}

/**
 * Every public call goes through here, so this is the one place that can
 * promise the pre-rename records are in before a read could miss them.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
  fallback: T,
): Promise<T> {
  await migrateLegacyDatabase();
  return runOnStore(mode, run, fallback);
}

/**
 * Keep the bytes of one unfinished file, with its transfer position.
 *
 * Resolves `true` when the bytes are actually durable and `false` when they
 * are not — IndexedDB unavailable (a private window) or refusing the write
 * (a full quota). The caller needs that distinction: a session that never
 * gets durable storage still works in memory, but a reload will not bring
 * this file back, and the learner deserves to be told rather than to find
 * out the hard way. See `blobStorageDegraded` in use-create-scan-draft.ts.
 */
export async function putDraftFile(
  draftId: string,
  fileId: string,
  blob: Blob,
  session: MultipartSession | null = null,
): Promise<boolean> {
  const record: StoredDraftFile = {
    id: keyFor(draftId, fileId),
    draftId,
    fileId,
    blob,
    session,
  };
  // `store.put` resolves to the record's key on success; the shared fallback
  // this module uses everywhere else is `undefined`, which doubles as "it
  // did not work" here.
  const key = await withStore<IDBValidKey | undefined>(
    'readwrite',
    (store) => store.put(record),
    undefined,
  );
  return key !== undefined;
}

/**
 * Update only the transfer position, leaving the bytes alone.
 *
 * Called after every accepted part, which is often, so it must not rewrite a
 * 28 MB blob each time. Reads the record first and puts it back with the new
 * session; a missing record is a no-op, because the file has already finished.
 */
export async function putDraftSession(
  draftId: string,
  fileId: string,
  session: MultipartSession,
): Promise<void> {
  const existing = await withStore<StoredDraftFile | undefined>(
    'readonly',
    (store) => store.get(keyFor(draftId, fileId)),
    undefined,
  );
  if (!existing) return;

  await withStore('readwrite', (store) => store.put({ ...existing, session }), undefined);
}

/** Everything kept for one draft. */
export async function readDraftFiles(draftId: string): Promise<StoredDraftFile[]> {
  const all = await withStore<StoredDraftFile[]>(
    'readonly',
    (store) => store.index('draftId').getAll(draftId),
    [],
  );
  return Array.isArray(all) ? all : [];
}

/** Drop one file's bytes. Called the moment its upload completes. */
export async function dropDraftFile(draftId: string, fileId: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(keyFor(draftId, fileId)), undefined);
}

/** Drop everything for a draft — on submit, on discard, and on sign-out. */
export async function clearDraftFiles(draftId: string): Promise<void> {
  const records = await readDraftFiles(draftId);
  for (const record of records) {
    await withStore('readwrite', (store) => store.delete(record.id), undefined);
  }
}
