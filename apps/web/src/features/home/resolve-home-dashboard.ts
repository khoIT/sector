import {
  GROUP_ADMIN_BYPASS_PERMISSIONS,
  hasAnyPermission,
  type AuthUser,
} from '@sector/api-client';
import type { ComponentType } from 'react';

import { AdminHome } from './admin-home';
import { GroupLeaderHome } from './group-leader-home';
import { LearnerHome } from './learner-home';
import { ScanReviewerHome } from './scan-reviewer-home';

/**
 * Which dashboard a signed-in account gets, decided by PERMISSION first and
 * role slug second.
 *
 * Two failure modes, pointing in opposite directions, both real:
 *
 *   1. The legacy `RoleDashboardRouter` sent `group_leader` and `scan_reviewer`
 *      to `<AdminDashboard/>` — a surface built for a third role, member table
 *      and all — so two roles never saw a dashboard of their own.
 *   2. Replacing that with a table of four slugs demoted the opposite end: the
 *      `superadmin` role (154 permissions, `full-access` and
 *      `admin:full-access`) is in no table of the four seeded accounts, so the
 *      most privileged account in the product landed on the LEARNER home while
 *      its own sidebar still offered group administration.
 *
 * The fix for (2) is not a fifth slug. A table that has to be edited whenever
 * someone adds a role is the same fragility as reading behaviour off an
 * English label: it keeps working right up until the data changes underneath
 * it. Full access is a property the role carries, so ask the role.
 * `GROUP_ADMIN_BYPASS_PERMISSIONS` is the same constant `useGroups` uses to
 * decide between every group and only-the-ones-I-lead, which is exactly the
 * distinction the administrator home is built on, and the legacy router
 * checked the same permission before its own slug switch.
 *
 * Below that, slugs still decide, because group leader / scan reviewer /
 * subscriber differ by job rather than by privilege. A slug this table does
 * not recognise gets the LEARNER home: an unrecognised role is the
 * least-privileged case, and the administrator home is the most powerful one
 * to hand out by accident.
 *
 * Keys are lower-cased slugs, matching `user.role.slug` (`authRoleSchema`) —
 * verified against the mirror's `roles` collection, where every slug is
 * underscore-separated regardless of what `role.name` spells out
 * (`group_leader`'s name is `'group leader'`, with a space; comparing against
 * `role.name` was the legacy bug that made an equivalent admin-course-chart
 * escape hatch dead code — see dashboard.controller.ts).
 */
const DASHBOARD_BY_ROLE_SLUG: Readonly<Record<string, ComponentType>> = {
  administrator: AdminHome,
  group_leader: GroupLeaderHome,
  scan_reviewer: ScanReviewerHome,
  subscriber: LearnerHome,
};

/**
 * The dashboard component for a signed-in user.
 *
 * Any role holding full access gets the administrator home whether or not its
 * slug is known here. Unknown, missing or malformed slugs without that
 * permission all resolve to the learner home.
 */
export function resolveHomeDashboard(
  user: Pick<AuthUser, 'role'> | null | undefined,
): ComponentType {
  if (hasAnyPermission(user, [...GROUP_ADMIN_BYPASS_PERMISSIONS])) return AdminHome;

  const slug = user?.role.slug;
  if (!slug) return LearnerHome;
  return DASHBOARD_BY_ROLE_SLUG[slug.toLowerCase()] ?? LearnerHome;
}
