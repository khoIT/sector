import type { ReactElement } from 'react';
import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

import { RequirePermission } from '@/auth/require-auth';
import { FirstPermittedRedirect } from './first-permitted-redirect';
import {
  SCAN_VAULT_PATH,
  SCAN_VAULT_PERMISSION,
  type ScanVaultView,
} from '@/features/scan-list/scan-list-views';

import { pageMeasure } from '@/routes/route-measure';

/**
 * The Scan Vault tabs.
 *
 * THIS IS THE COORDINATION FILE for the tab surfaces. To hand a different page
 * to a tab, change only its `lazy()` import below and its entry in
 * TAB_ELEMENT; the paths, the permission gates and the sidebar entry all stay
 * put. (A module with a default export needs no `.then`.)
 *
 * Four tabs, six leaf routes: Group and Expert each own an unreviewed and a
 * reviewed list, and the two need DIFFERENT permissions. The legacy V2 tab bar
 * declared no permission on either reviewed sub-tab and its NavigationTabs
 * treated a missing permission as "always allow", so `view:scan:reviewed` and
 * `view:scan:reviewed:expert` were never checked client-side at all. Guarding
 * each leaf separately closes that hole, and matches the server: the reviewed
 * routes really do 403 (verified against all four demo accounts on :5001).
 *
 * Paths and permissions come from features/scan-list/scan-list-views.ts so the
 * router, the sidebar and the in-page tab bar cannot disagree about a URL.
 */

const MyScansPage = lazy(() =>
  import('@/features/scan-list/pages/my-scans-page').then((m) => ({ default: m.MyScansPage })),
);

const SharedScansPage = lazy(() =>
  import('@/features/scan-list/pages/shared-scans-page').then((m) => ({
    default: m.SharedScansPage,
  })),
);

/** The four queue/record lists are one component; the view is the only difference. */
const ScanListPage = lazy(() =>
  import('@/features/scan-list/pages/scan-list-page').then((m) => ({ default: m.ScanListPage })),
);

/** Which component renders which surface. */
const TAB_ELEMENT: Record<ScanVaultView, ReactElement> = {
  my: <MyScansPage />,
  shared: <SharedScansPage />,
  pending: <ScanListPage view="pending" />,
  reviewed: <ScanListPage view="reviewed" />,
  expert: <ScanListPage view="expert" />,
  'expert-reviewed': <ScanListPage view="expert-reviewed" />,
};

/** Nav order, spelled out rather than taken from object key order. */
const TAB_VIEWS: readonly ScanVaultView[] = [
  'my',
  'shared',
  'pending',
  'reviewed',
  'expert',
  'expert-reviewed',
];

/**
 * Children of `/` are matched relatively, so the leading slash of the absolute
 * path table has to come off here.
 */
function relativePath(view: ScanVaultView): string {
  return SCAN_VAULT_PATH[view].replace(/^\//, '');
}

function routeFor(view: ScanVaultView): RouteObject {
  const leaf: RouteObject = {
    path: relativePath(view),
    element: TAB_ELEMENT[view],
    handle: pageMeasure('working'),
  };
  const permission = SCAN_VAULT_PERMISSION[view];

  // The gate is a pathless layout route rather than a check inside the page,
  // so it is visible in the route table and cannot be forgotten on a new tab.
  return permission
    ? { element: <RequirePermission required={permission} />, children: [leaf] }
    : leaf;
}

export const scanVaultRoutes: RouteObject[] = [
  ...TAB_VIEWS.map(routeFor),

  // The sidebar links straight to a leaf, but the parent URLs are the obvious
  // thing to type, so send them to the first surface underneath that this role
  // may open — the unreviewed queue is not it for a role that may read only
  // the reviewed list, and sending them there was a 403 on a typed URL.
  {
    path: 'scans/group',
    element: <FirstPermittedRedirect views={['pending', 'reviewed']} />,
    handle: pageMeasure('working'),
  },
  {
    path: 'scans/expert',
    element: <FirstPermittedRedirect views={['expert', 'expert-reviewed']} />,
    handle: pageMeasure('working'),
  },
  {
    path: 'scans',
    element: <Navigate to={SCAN_VAULT_PATH.my} replace />,
    handle: pageMeasure('working'),
  },
];
