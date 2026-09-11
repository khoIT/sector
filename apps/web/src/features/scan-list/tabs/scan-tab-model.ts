import { hasPermission, type AuthUser } from '@scanvault/api-client';

import { SCAN_VAULT_PATH, SCAN_VAULT_PERMISSION, type ScanVaultView } from '../scan-list-views';

/**
 * The tab tree: FOUR top-level tabs, two of which carry sub-tabs. The legacy
 * dashboard shipped this shape behind the `scans_new_ui_v2` flag alongside a
 * six-flat-tab fallback; only the four-tab shape survives here.
 *
 * It also closes a real gating hole in the legacy V2 tab bar: its reviewed
 * sub-tabs carried NO permission key, and the shared NavigationTabs component
 * treated a missing permission as "always allow". A user holding only
 * `view:scan:pending` could therefore see and open the group-REVIEWED list,
 * which the V1 bar hid behind `view:scan:reviewed`. Every sub-tab here names
 * its own permission, and a parent tab disappears when no child survives.
 */

export type ScanSubTab = {
  view: ScanVaultView;
  label: string;
  path: string;
};

export type ScanTab = {
  id: string;
  label: string;
  /** The surface a bare click on the parent lands on (the first visible child). */
  view: ScanVaultView;
  path: string;
  subTabs: ScanSubTab[];
};

type TabSpec = {
  id: string;
  label: string;
  children: Array<{ view: ScanVaultView; label: string }>;
};

const TAB_SPECS: TabSpec[] = [
  {
    id: 'my',
    label: 'My Scans',
    children: [{ view: 'my', label: 'My Scans' }],
  },
  {
    id: 'shared',
    label: 'Shared Scans',
    children: [{ view: 'shared', label: 'Shared Scans' }],
  },
  {
    id: 'group',
    label: 'Group Scans',
    children: [
      { view: 'pending', label: 'Unreviewed' },
      { view: 'reviewed', label: 'Reviewed' },
    ],
  },
  {
    id: 'expert',
    label: 'Expert Scans',
    children: [
      { view: 'expert', label: 'Unreviewed' },
      { view: 'expert-reviewed', label: 'Reviewed' },
    ],
  },
];

function canSee(user: AuthUser | null, view: ScanVaultView): boolean {
  const permission = SCAN_VAULT_PERMISSION[view];
  if (permission === null) return true;
  return hasPermission(user, permission);
}

/**
 * The tabs this user may actually open. A parent with a single child renders
 * as a plain tab; a parent whose children are all denied is dropped entirely.
 */
export function visibleScanTabs(user: AuthUser | null): ScanTab[] {
  const tabs: ScanTab[] = [];

  for (const spec of TAB_SPECS) {
    const allowed = spec.children.filter((child) => canSee(user, child.view));
    const landing = allowed[0];
    if (!landing) continue;

    const subTabs: ScanSubTab[] =
      spec.children.length > 1
        ? allowed.map((child) => ({
            view: child.view,
            label: child.label,
            path: SCAN_VAULT_PATH[child.view],
          }))
        : [];

    tabs.push({
      id: spec.id,
      label: spec.label,
      view: landing.view,
      path: SCAN_VAULT_PATH[landing.view],
      subTabs,
    });
  }

  return tabs;
}

/** Every view this user may open, in tab order. */
export function visibleScanViews(user: AuthUser | null): ScanVaultView[] {
  return visibleScanTabs(user).flatMap((tab) =>
    tab.subTabs.length > 0 ? tab.subTabs.map((sub) => sub.view) : [tab.view],
  );
}

export function canOpenView(user: AuthUser | null, view: ScanVaultView): boolean {
  return canSee(user, view);
}

/** The parent tab that owns a view, for highlighting the active pill. */
export function tabIdForView(view: ScanVaultView): string {
  const spec = TAB_SPECS.find((candidate) =>
    candidate.children.some((child) => child.view === view),
  );
  return spec?.id ?? 'my';
}
