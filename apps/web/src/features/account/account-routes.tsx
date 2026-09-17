import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

import { pageMeasure } from '@/routes/route-measure';

/**
 * The profile page's route.
 *
 * No permission gate: every route behind it is scoped to the caller by the
 * server's `authUser` middleware and there is no user id in any path, so there
 * is nothing a signed-in user could reach here that is not their own.
 *
 * Lazily loaded — it is reached from a menu, not from the lists, so it has no
 * business in the entry chunk.
 */
const ProfilePage = lazy(() =>
  import('./profile-page').then((module) => ({ default: module.ProfilePage })),
);

export const accountRoutes: RouteObject[] = [
  { path: 'profile', element: <ProfilePage />, handle: pageMeasure('reading') },
];
