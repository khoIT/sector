import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

import { GALLERY_ROUTE_PATH } from './gallery-links';

import { pageMeasure } from '@/routes/route-measure';

/**
 * Route for the pathology gallery, spread into `featureRoutes`.
 *
 * No permission gate: all three routes it calls require only `authUser`, and
 * carry no `create`/`edit`/`delete` verb — matching CONTRACTS.md's note that
 * this surface is 3 read-only endpoints, no writes, no permissions.
 */
const GalleryPage = lazy(() =>
  import('./gallery-page').then((module) => ({ default: module.GalleryPage })),
);

export const galleryRoutes: RouteObject[] = [
  { path: GALLERY_ROUTE_PATH, element: <GalleryPage />, handle: pageMeasure('working') },
];
