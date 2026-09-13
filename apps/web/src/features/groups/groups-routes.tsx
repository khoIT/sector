import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

import { RequirePermission } from '@/auth/require-auth';

import { GROUP_MEMBERS_ROUTE_PATH, GROUPS_INDEX_ROUTE_PATH } from './groups-links';

/**
 * Routes for the group-administration surfaces, spread into `featureRoutes`.
 *
 * Gated on `read:group` as ONE pathless layout route covering both pages —
 * the server's own guard for every route this feature calls (`GET /api/groups`,
 * `GET /api/groups/manage`, `GET /api/group-members`,
 * `GET /api/groups/manage/member/:groupId` all require it), so a role that
 * cannot read groups cannot deep-link into either page.
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
