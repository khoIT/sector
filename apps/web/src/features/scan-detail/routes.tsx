import { SCAN_LIST_VIEWS } from '@scanvault/api-client';
import type { RouteObject } from 'react-router-dom';

import { RequirePermission } from '@/auth/require-auth';

import { ScanDetailPage } from './scan-detail-page';
import {
  scanDetailRoutePath,
  SCAN_VIEW_PERMISSION,
  SHARED_SCAN_DETAIL_ROUTE_PATH,
} from './scan-detail-links';
import { SharedScanDetailPage } from './shared-scan-detail-page';

/**
 * Routes for the scan detail surface, ready to spread into `featureRoutes`:
 *
 *   import { scanDetailRoutes } from '@/features/scan-detail';
 *   export const featureRoutes = [...scanListRoutes, ...scanDetailRoutes];
 *
 * Mounted as siblings of the list routes rather than as children of the list
 * layout: the paths are `<list path>/:scanId`, which the list layout's own
 * children do not match, and a detail page has no use for the list toolbar.
 *
 * One route per view, each behind the permission that view's server routes are
 * guarded by, so a role that cannot read a queue cannot deep-link into a scan
 * in it either. The shared route is ungated — access is decided by the share
 * record, and the server 403s anyone but the recipient.
 */
export const scanDetailRoutes: RouteObject[] = [
  ...SCAN_LIST_VIEWS.map((view) => ({
    element: <RequirePermission required={SCAN_VIEW_PERMISSION[view]} />,
    children: [{ path: scanDetailRoutePath(view), element: <ScanDetailPage view={view} /> }],
  })),
  { path: SHARED_SCAN_DETAIL_ROUTE_PATH, element: <SharedScanDetailPage /> },
];
