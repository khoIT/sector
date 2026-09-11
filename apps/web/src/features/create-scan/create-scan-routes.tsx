import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

import { RequirePermission } from '@/auth/require-auth';

/**
 * The create-scan wizard's route.
 *
 * Lazily loaded: the wizard pulls in the media-validation code and the scan
 * type catalogue, none of which the list surfaces need.
 */
const CreateScanPage = lazy(() =>
  import('./create-scan-page').then((module) => ({ default: module.CreateScanPage })),
);

export const createScanRoutes: RouteObject[] = [
  {
    // Gated as a pathless layout route so the permission is visible in the
    // route table rather than buried in the page.
    element: <RequirePermission required="create:scan" />,
    children: [{ path: 'scans/create', element: <CreateScanPage /> }],
  },
];
