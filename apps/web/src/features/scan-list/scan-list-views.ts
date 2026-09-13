import type { ScanListView } from '@sector/api-client';

/**
 * The six Scan Vault surfaces, as URLs.
 *
 * Five of them are `ScanListView`s from the API client (they share the
 * /api/scan/* list contract). The sixth, shared-scans, is a different resource
 * (/api/shared-scans) with a different filter vocabulary, so it is modelled as
 * its own id rather than squeezed into ScanListView.
 */
export type ScanVaultView = ScanListView | 'shared';

export const SCAN_VAULT_ROOT = '/scans';

/** Route path per view. Absolute, for links; the router mounts them relative. */
export const SCAN_VAULT_PATH: Record<ScanVaultView, string> = {
  my: '/scans/my',
  shared: '/scans/shared',
  pending: '/scans/group/unreviewed',
  reviewed: '/scans/group/reviewed',
  expert: '/scans/expert/unreviewed',
  'expert-reviewed': '/scans/expert/reviewed',
};

/**
 * Permission each surface needs. `null` means always visible: the legacy tab
 * bar gated Shared Scans on nothing, and the server scopes /api/shared-scans
 * to the caller's own email, so there is nothing to gate on.
 */
export const SCAN_VAULT_PERMISSION: Record<ScanVaultView, string | null> = {
  my: 'view:scan',
  shared: null,
  pending: 'view:scan:pending',
  reviewed: 'view:scan:reviewed',
  expert: 'view:scan:pending:expert',
  'expert-reviewed': 'view:scan:reviewed:expert',
};

export const SCAN_VAULT_TITLE: Record<ScanVaultView, string> = {
  my: 'My Scans',
  shared: 'Shared Scans',
  pending: 'Group Scans — Unreviewed',
  reviewed: 'Group Scans — Reviewed',
  expert: 'Expert Scans — Unreviewed',
  'expert-reviewed': 'Expert Scans — Reviewed',
};

/** Every view that reads from the /api/scan/* list family. */
export function isScanListView(view: ScanVaultView): view is ScanListView {
  return view !== 'shared';
}

/** True for the two review QUEUES, where waiting time and assessment matter. */
export function isReviewQueue(view: ScanVaultView): view is 'pending' | 'expert' {
  return view === 'pending' || view === 'expert';
}

/** True for the two already-reviewed lists. */
export function isReviewedList(view: ScanVaultView): view is 'reviewed' | 'expert-reviewed' {
  return view === 'reviewed' || view === 'expert-reviewed';
}

/**
 * Where the Create Scan Study call to action goes.
 *
 * The wizard registers itself at `scans/create` (features/create-scan), not
 * under the My Scans subtree — a draft is not a scan yet.
 */
export const CREATE_SCAN_PATH = '/scans/create';

/*
 * Detail URLs deliberately do NOT come from this table. The scan detail
 * surface owns `/scans/<view>/:scanId` and exports the builders for it in
 * features/scan-detail/scan-detail-links.ts; the list links straight at those
 * so the two cannot drift.
 */
