import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

import { SAGE_ROUTE_PATH } from './sage-links';

import { pageMeasure } from '@/routes/route-measure';

/**
 * Route for the Sage AI frame, spread into `featureRoutes`. Ungated beyond
 * being signed in — the legacy nav entry carried no permission or feature
 * flag either.
 */
const SageFrame = lazy(() =>
  import('./sage-frame').then((module) => ({ default: module.SageFrame })),
);

export const sageRoutes: RouteObject[] = [
  { path: SAGE_ROUTE_PATH, element: <SageFrame />, handle: pageMeasure('full') },
];
