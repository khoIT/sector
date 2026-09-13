import type { ComponentType } from 'react';

import { AdminHome } from './admin-home';
import { GroupLeaderHome } from './group-leader-home';
import { LearnerHome } from './learner-home';
import { ScanReviewerHome } from './scan-reviewer-home';

/**
 * Role slug → dashboard, with NO fallthrough to the administrator dashboard.
 *
 * The legacy `RoleDashboardRouter` sent `group_leader` and `scan_reviewer` to
 * `<AdminDashboard/>` — a surface built for a third role, member table and
 * all — leaving 412 lines of purpose-built dashboards unshipped. A role this
 * table does not recognise gets the LEARNER home instead, never the admin
 * one: an unrecognised role is the least-privileged case, and the admin
 * dashboard is the most powerful one to hand it by accident.
 *
 * Keys are lower-cased slugs, matching `user.role.slug` (`authRoleSchema`) —
 * verified against the four seeded accounts, all four of which use an
 * underscore-separated slug regardless of what `role.name` spells out
 * (`role.name` for group_leader is `'group leader'`, with a space; a
 * comparison against `role.name` was the legacy bug that made an equivalent
 * admin-course-chart escape hatch dead code — see dashboard.controller.ts).
 */
const DASHBOARD_BY_ROLE_SLUG: Readonly<Record<string, ComponentType>> = {
  administrator: AdminHome,
  group_leader: GroupLeaderHome,
  scan_reviewer: ScanReviewerHome,
  subscriber: LearnerHome,
};

/** The dashboard component for a role slug. Unknown, missing or malformed
 *  slugs all resolve to the learner home. */
export function resolveHomeDashboard(roleSlug: string | null | undefined): ComponentType {
  if (!roleSlug) return LearnerHome;
  return DASHBOARD_BY_ROLE_SLUG[roleSlug.toLowerCase()] ?? LearnerHome;
}
