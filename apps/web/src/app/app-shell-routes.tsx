import type { RouteObject } from 'react-router-dom';

import { HomeRoute } from '@/features/home/home-route';
import { featureRoutes } from '@/routes/feature-routes';
import { pageMeasure } from '@/routes/route-measure';

import { LegacyRedirect } from './legacy-redirect';
import { LEGACY_ROOTS } from './legacy-route-map';
import { NotFoundPage } from './not-found-page';
import { scanVaultRoutes } from './scan-vault-routes';

/**
 * Everything the app shell renders, as its own export.
 *
 * Exported so `routes/route-measures.test.ts` can walk it. These four shapes —
 * the index, the two legacy-root redirects and the catch-all — are declared
 * here rather than in `featureRoutes` or `scanVaultRoutes`, so a walk of those
 * two alone checks two of the three mounting points and silently skips the one
 * this file owns.
 */
export const appShellRoutes: RouteObject[] = [
  { index: true, element: <HomeRoute />, handle: pageMeasure('working') },
  ...scanVaultRoutes,
  ...featureRoutes,
  // Every URL the dashboard served resolves here — to the surface that took
  // over, or to a page that says the surface was retired. The API writes
  // `/dashboard/scans/...` into every scan notification, and bookmarks keep
  // the rest (app/legacy-route-map.ts).
  ...LEGACY_ROOTS.map((root) => ({
    path: `${root}/*`,
    element: <LegacyRedirect />,
    handle: pageMeasure('reading'),
  })),
  ...LEGACY_ROOTS.map((root) => ({
    path: root,
    element: <LegacyRedirect />,
    handle: pageMeasure('reading'),
  })),
  { path: '*', element: <NotFoundPage />, handle: pageMeasure('reading') },
];
