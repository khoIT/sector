import { SCAN_VAULT_PATH } from '@/features/scan-list/scan-list-views';

/**
 * Where a legacy dashboard URL should land here.
 *
 * The API mints these itself: every scan notification carries
 * `resourceUrl: /dashboard/scans/my-scans/<id>`, and the submission emails
 * that now go out on every study are built from it. Those links are in
 * people's inboxes and browser histories, so the paths have to resolve rather
 * than 404 — a dead link in the email announcing a study is worse than no
 * email.
 *
 * Returns null for anything outside the legacy scan tree, which the router
 * then hands to the normal 404.
 */

const LIST_PATH: Record<string, string> = {
  'my-scans': SCAN_VAULT_PATH.my,
  'shared-scans': SCAN_VAULT_PATH.shared,
  'pending-scans': SCAN_VAULT_PATH.pending,
  'reviewed-scans': SCAN_VAULT_PATH.reviewed,
  'expert-scans': SCAN_VAULT_PATH.expert,
  'expert-reviewed-scans': SCAN_VAULT_PATH['expert-reviewed'],
};

export function legacyScanPath(pathname: string): string | null {
  const match = /^\/dashboard\/scans(?:\/([^/]+))?(?:\/([^/]+))?\/?$/.exec(pathname);
  if (!match) return null;

  const [, list, tail] = match;
  if (!list) return SCAN_VAULT_PATH.my;

  const base = LIST_PATH[list];
  if (!base) return null;

  // `/my-scans/create` is the wizard, not a scan whose id is "create".
  if (list === 'my-scans' && tail === 'create') return '/scans/create';
  if (!tail) return base;

  // Legacy `/upload-file` and any other trailing segment are dropped: the
  // three-segment forms have no equivalent here, and the scan itself is the
  // closest true destination.
  return `${base}/${tail}`;
}
