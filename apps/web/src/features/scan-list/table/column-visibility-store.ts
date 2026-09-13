import type { ScanVaultView } from '../scan-list-views';

/**
 * Hidden-column choices, kept per user and per view.
 *
 * Per view because the queues and My Scans do not share a column set; per user
 * because two accounts on one browser see different tables. Guarded like every
 * other localStorage access here: a blocked or full store degrades to the
 * view's default columns rather than throwing on render.
 */

export const COLUMN_VISIBILITY_KEY_PREFIX = 'sector.scan-list.columns.';

function keyFor(userId: string, view: ScanVaultView): string {
  return `${COLUMN_VISIBILITY_KEY_PREFIX}${userId}.${view}`;
}

export function readHiddenColumns(
  userId: string | undefined,
  view: ScanVaultView,
): string[] | null {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(keyFor(userId, view));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return null;
  }
}

export function writeHiddenColumns(
  userId: string | undefined,
  view: ScanVaultView,
  hidden: string[],
): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(keyFor(userId, view), JSON.stringify(hidden));
  } catch {
    // Non-essential: the choice just does not survive a reload.
  }
}

export function clearHiddenColumns(userId: string | undefined, view: ScanVaultView): void {
  if (!userId) return;
  try {
    window.localStorage.removeItem(keyFor(userId, view));
  } catch {
    // Nothing to do.
  }
}
