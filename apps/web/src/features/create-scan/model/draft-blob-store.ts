import type { MultipartSession } from '@scanvault/api-client';

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

const DATABASE = 'scanvault.create-scan';
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
      request = version === undefined
        ? globalThis.indexedDB.open(DATABASE)
        : globalThis.indexedDB.open(DATABASE, version);
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

/** Run one transaction, resolving to `fallback` on any failure. */
async function withStore<T>(
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

/** Keep the bytes of one unfinished file, with its transfer position. */
export async function putDraftFile(
  draftId: string,
  fileId: string,
  blob: Blob,
  session: MultipartSession | null = null,
): Promise<void> {
  const record: StoredDraftFile = { id: keyFor(draftId, fileId), draftId, fileId, blob, session };
  await withStore('readwrite', (store) => store.put(record), undefined);
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
