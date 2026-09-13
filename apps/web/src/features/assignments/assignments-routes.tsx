import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

import { RequirePermission } from '@/auth/require-auth';

import { GROUP_ASSIGNMENTS_ROUTE_PATH } from './assignments-links';

/**
 * Route for one group's assignments, spread into `featureRoutes`.
 *
 * Gated on `read:group-assignment` — the permission the API's
 * `group-assignment.route.ts` requires for every read on this domain, and
 * every seeded group-leader/administrator role holds it (a bare subscriber
 * does not).
 */
const AssignmentsSurface = lazy(() =>
  import('./assignments-surface').then((module) => ({ default: module.AssignmentsSurface })),
);

export const assignmentsRoutes: RouteObject[] = [
  {
    element: <RequirePermission required="read:group-assignment" />,
    children: [{ path: GROUP_ASSIGNMENTS_ROUTE_PATH, element: <AssignmentsSurface /> }],
  },
];
