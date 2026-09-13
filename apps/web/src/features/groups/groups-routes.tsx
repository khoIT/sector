import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

import { RequirePermission } from '@/auth/require-auth';

import { GROUP_MEMBERS_ROUTE_PATH, GROUPS_INDEX_ROUTE_PATH } from './groups-links';

/**
 * Routes for the group-administration surfaces, spread into `featureRoutes`.
 *
 * Gated on `read:group` as ONE pathless layout route covering both pages.
 * `read:group` is the permission every seeded group role shares (leader,
 * reviewer, administrator, superadmin all hold it) — it is NOT literally the
 * guard on every route this page calls: `GET /api/groups` requires it, but
 * `GET /api/groups/manage` and `GET /api/groups/manage/member/:groupId` are
 * `authUser` only and rely on server-side leadership scoping instead, and
 * `GET /api/group-members` requires `read:group-member`. Gating the ROUTE on
 * `read:group` still keeps out the one role with none of these (subscriber);
 * the individual endpoints layer their own, different checks on top.
 *
 * Lazily loaded: reached from the "Administer" nav section, not from a list a
 * page depends on at boot.
 */
const GroupsIndexPage = lazy(() =>
  import('./index/groups-index-page').then((module) => ({ default: module.GroupsIndexPage })),
);
const MembersSurface = lazy(() =>
  import('./members/members-surface').then((module) => ({ default: module.MembersSurface })),
);

export const groupsRoutes: RouteObject[] = [
  {
    element: <RequirePermission required="read:group" />,
    children: [
      { path: GROUPS_INDEX_ROUTE_PATH, element: <GroupsIndexPage /> },
      { path: GROUP_MEMBERS_ROUTE_PATH, element: <MembersSurface /> },
    ],
  },
];
