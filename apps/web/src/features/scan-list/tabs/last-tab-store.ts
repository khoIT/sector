import type { ScanVaultView } from '../scan-list-views';

/**
 * Remembers the Scan Vault tab a user was last on, per user.
 *
 * Keyed by user id so two accounts on one browser do not inherit each other's
 * landing tab — a reviewer and a learner see different tab sets, and landing a
 * learner on the group queue would show them a permission redirect instead of
 * their scans.
 *
 * Every access is guarded: localStorage throws in a private window and in
 * embedded webviews with site data blocked, and a remembered tab is a
 * convenience, never state the app depends on.
 */

export const LAST_TAB_KEY_PREFIX = 'sector.scan-list.last-tab.';

function keyFor(userId: string): string {
  return `${LAST_TAB_KEY_PREFIX}${userId}`;
}

export function readLastTab(userId: string | undefined): ScanVaultView | null {
  if (!userId) return null;
  try {
    return (window.localStorage.getItem(keyFor(userId)) as ScanVaultView | null) ?? null;
  } catch {
    return null;
  }
}

export function writeLastTab(userId: string | undefined, view: ScanVaultView): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(keyFor(userId), view);
  } catch {
    // Nothing to do: the landing tab simply falls back to the first allowed one.
  }
}
