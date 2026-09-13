import { SESSION_STORAGE_KEY } from '@sector/api-client';
import { THEME_STORAGE_KEY } from '@sector/ui';

import { CREATE_SCAN_FLOW_KEY } from '@/features/create-scan/model/create-scan-flow';
import { DRAFT_STORAGE_KEY } from '@/features/create-scan/model/draft-storage';
import { REVIEW_DRAFT_KEY_PREFIX } from '@/features/scan-detail/review-draft-store';
import { COLUMN_VISIBILITY_KEY_PREFIX } from '@/features/scan-list/table/column-visibility-store';
import { LAST_TAB_KEY_PREFIX } from '@/features/scan-list/tabs/last-tab-store';

/**
 * Carry what the browser already holds into the `sector.` namespace.
 *
 * Renaming a persisted key is the one part of a product rename that can
 * destroy someone's work in silence. A create-scan draft may hold seven days
 * of a learner's study, and a session is the difference between opening the
 * app and being thrown back to the login screen; both would simply be absent
 * under the new name, with nothing to report and nothing to recover from.
 *
 * So every key moves once, on the load after the upgrade, and the old one is
 * dropped behind it. The copy is one-way and one-time: it reads the old name
 * only, so a browser that has already been through it finds nothing and does
 * nothing, and a value already written under the new name is never replaced by
 * the stale copy beside it.
 *
 * The IndexedDB side of a draft — the bytes of its unfinished uploads — cannot
 * move here, because that store is asynchronous and this sweep has to finish
 * before the first render. It migrates itself, inside
 * `features/create-scan/model/draft-blob-store.ts`.
 */

export const STORAGE_NAMESPACE = 'sector.';
const LEGACY_STORAGE_NAMESPACE = 'scanvault.';

export type PersistedKey = {
  /** The name under the current namespace. */
  name: string;
  /**
   * `exact` is one key. `prefix` is a family of them — a per-user or per-view
   * suffix follows — and every member has to move, not just a name the sweep
   * could have guessed.
   */
  shape: 'exact' | 'prefix';
};

/**
 * Everything this app persists under its own namespace.
 *
 * The names are imported, never retyped, so a key cannot be changed in its
 * store and forgotten here. `storage-migration.test.ts` reads this table back
 * against the workspace source and fails when the two disagree.
 */
export const PERSISTED_KEYS: readonly PersistedKey[] = [
  { name: DRAFT_STORAGE_KEY, shape: 'exact' },
  { name: CREATE_SCAN_FLOW_KEY, shape: 'exact' },
  { name: SESSION_STORAGE_KEY, shape: 'exact' },
  { name: THEME_STORAGE_KEY, shape: 'exact' },
  { name: REVIEW_DRAFT_KEY_PREFIX, shape: 'prefix' },
  { name: LAST_TAB_KEY_PREFIX, shape: 'prefix' },
  { name: COLUMN_VISIBILITY_KEY_PREFIX, shape: 'prefix' },
];

/** The same name in the namespace this app used to write under. */
export function legacyNameFor(name: string): string {
  return LEGACY_STORAGE_NAMESPACE + name.slice(STORAGE_NAMESPACE.length);
}

type MigratableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/** Guarded like every other storage access here: a private window throws. */
function browserStorage(): MigratableStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function moveKey(storage: MigratableStorage, from: string, to: string): void {
  try {
    const legacy = storage.getItem(from);
    if (legacy === null) return;

    // Only when nothing is there. A value under the new name was written by
    // this build and is newer than anything the old one holds; overwriting it
    // would hand the user back a draft or a preference they already replaced.
    if (storage.getItem(to) === null) storage.setItem(to, legacy);

    // After the write, never before: a quota failure throws out of setItem and
    // skips this, which leaves the old copy intact to be tried again next load
    // rather than deleting the only copy there was.
    storage.removeItem(from);
  } catch {
    // A blocked or full store costs this one key. The app still boots, and the
    // value is read as absent — the same as any first-time visitor.
  }
}

/**
 * The old keys in one family, read before anything moves.
 *
 * Taken as a snapshot because removing a key renumbers the ones after it, and
 * an index walk that mutates as it goes skips every other entry.
 */
function legacyKeysUnder(storage: MigratableStorage, legacyPrefix: string): string[] {
  const found: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(legacyPrefix)) found.push(key);
    }
  } catch {
    // Nothing more to find; whatever was collected still moves.
  }
  return found;
}

/**
 * Run before the first render — see `main.tsx` for why the timing matters.
 *
 * Synchronous on purpose, and safe to call twice.
 */
export function migratePersistedStorage(
  storage: MigratableStorage | null = browserStorage(),
): void {
  if (!storage) return;

  for (const key of PERSISTED_KEYS) {
    const legacyName = legacyNameFor(key.name);

    if (key.shape === 'exact') {
      moveKey(storage, legacyName, key.name);
      continue;
    }

    for (const legacyKey of legacyKeysUnder(storage, legacyName)) {
      const name = STORAGE_NAMESPACE + legacyKey.slice(LEGACY_STORAGE_NAMESPACE.length);
      moveKey(storage, legacyKey, name);
    }
  }
}
