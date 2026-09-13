import type { ScanListView } from '@sector/api-client';

import { SCAN_VAULT_PATH } from '@/features/scan-list/scan-list-views';

/**
 * Detail-page URLs and the return-URL round trip.
 *
 * The list surface links INTO these, so the builders live here and the path
 * table stays over there: a detail URL is always `<list path>/<id>`, and the
 * tab highlighting matches it by list-path prefix, so the two must agree
 * exactly. Imported from `scan-list-views` directly rather than through the
 * feature barrel — the barrel re-exports the list pages, which import these
 * builders, and going through it would make that an import cycle.
 */

export const SCAN_VIEW_LABEL: Record<ScanListView, string> = {
  my: 'my scans',
  pending: 'unreviewed group scans',
  reviewed: 'reviewed group scans',
  expert: 'unreviewed expert scans',
  'expert-reviewed': 'reviewed expert scans',
};

/** Permission each view's server routes are guarded by. */
export const SCAN_VIEW_PERMISSION: Record<ScanListView, string> = {
  my: 'view:scan',
  pending: 'view:scan:pending',
  reviewed: 'view:scan:reviewed',
  expert: 'view:scan:pending:expert',
  'expert-reviewed': 'view:scan:reviewed:expert',
};

/**
 * A scan's detail URL, carrying the list URL it was opened from so "Back"
 * restores the exact page, filters and sort the user left rather than dropping
 * them on page 1 of an unfiltered queue.
 */
export function scanDetailPathFor(
  view: ScanListView,
  scanId: string,
  returnUrl?: string,
): string {
  return withReturnUrl(`${SCAN_VAULT_PATH[view]}/${scanId}`, returnUrl);
}

/** Note the id is the SHARE's id, not the scan's: shares are per recipient. */
export function sharedScanDetailPathFor(shareId: string, returnUrl?: string): string {
  return withReturnUrl(`${SCAN_VAULT_PATH.shared}/${shareId}`, returnUrl);
}

function withReturnUrl(base: string, returnUrl?: string): string {
  return returnUrl ? `${base}?returnUrl=${encodeURIComponent(returnUrl)}` : base;
}

/** Route path for one view's detail page, relative to the app root. */
export function scanDetailRoutePath(view: ScanListView): string {
  return `${stripLeadingSlash(SCAN_VAULT_PATH[view])}/:scanId`;
}

export const SHARED_SCAN_DETAIL_ROUTE_PATH = `${stripLeadingSlash(SCAN_VAULT_PATH.shared)}/:shareId`;

export function scanListPathFor(view: ScanListView): string {
  return SCAN_VAULT_PATH[view];
}

export const SHARED_SCAN_LIST_PATH = SCAN_VAULT_PATH.shared;

function stripLeadingSlash(path: string): string {
  return path.replace(/^\//, '');
}

/**
 * Accept a `returnUrl` only when it is a same-origin, path-only URL.
 *
 * It arrives from the query string, so it is attacker-controllable: an
 * unchecked value turns every "Back" link into an open redirect. Anything with
 * a scheme, a protocol-relative `//host` prefix, or a fragment is rejected and
 * the caller falls back to the view's own list path.
 */
export function safeReturnUrl(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (raw.includes('#')) return fallback;
  return raw;
}
