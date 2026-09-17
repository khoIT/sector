import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

import { RequirePermission } from '@/auth/require-auth';

import {
  GROUP_ASSIGNMENTS_ROUTE_PATH,
  GROUP_COURSES_ROUTE_PATH,
  GROUP_EXPORTS_ROUTE_PATH,
  GROUP_MEMBERS_ROUTE_PATH,
  GROUP_SETTINGS_ROUTE_PATH,
  GROUPS_INDEX_ROUTE_PATH,
} from './groups-links';

import { pageMeasure } from '@/routes/route-measure';

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
 * page depends on at boot. Courses, assignments and exports are permission
 * gated only by the same `read:group` layout — each PAGE further narrows on
 * the write permission it needs (`GroupDetailTabs` hides the `settings` tab
 * without `edit:group`; the invite button hides without `create:group-member`;
 * and so on), rather than a second `RequirePermission` layer per tab, because
 * every tab is still a legitimate READ for anyone who can open the group at all.
 */
const GroupsIndexPage = lazy(() =>
  import('./index/groups-index-page').then((module) => ({ default: module.GroupsIndexPage })),
);
const MembersSurface = lazy(() =>
  import('./members/members-surface').then((module) => ({ default: module.MembersSurface })),
);
const GroupCoursesPanel = lazy(() =>
  import('./forms/group-courses-panel').then((module) => ({ default: module.GroupCoursesPanel })),
);
const GroupAssignmentsPanel = lazy(() =>
  import('./forms/group-assignments-panel').then((module) => ({
    default: module.GroupAssignmentsPanel,
  })),
);
const GroupExportsPanel = lazy(() =>
  import('./exports/group-exports-panel').then((module) => ({ default: module.GroupExportsPanel })),
);
const GroupSettingsPage = lazy(() =>
  import('./settings/group-settings-page').then((module) => ({
    default: module.GroupSettingsPage,
  })),
);

export const groupsRoutes: RouteObject[] = [
  {
    element: <RequirePermission required="read:group" />,
    children: [
      {
        path: GROUPS_INDEX_ROUTE_PATH,
        element: <GroupsIndexPage />,
        handle: pageMeasure('working'),
      },
      {
        path: GROUP_MEMBERS_ROUTE_PATH,
        element: <MembersSurface />,
        handle: pageMeasure('working'),
      },
      {
        path: GROUP_COURSES_ROUTE_PATH,
        element: <GroupCoursesPanel />,
        handle: pageMeasure('working'),
      },
      {
        path: GROUP_ASSIGNMENTS_ROUTE_PATH,
        element: <GroupAssignmentsPanel />,
        handle: pageMeasure('working'),
      },
      {
        path: GROUP_EXPORTS_ROUTE_PATH,
        element: <GroupExportsPanel />,
        handle: pageMeasure('working'),
      },
      {
        path: GROUP_SETTINGS_ROUTE_PATH,
        element: <GroupSettingsPage />,
        handle: pageMeasure('reading'),
      },
    ],
  },
];
