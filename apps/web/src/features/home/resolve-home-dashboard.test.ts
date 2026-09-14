import type { AuthUser } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { AdminHome } from './admin-home';
import { GroupLeaderHome } from './group-leader-home';
import { LearnerHome } from './learner-home';
import { resolveHomeDashboard } from './resolve-home-dashboard';
import { ScanReviewerHome } from './scan-reviewer-home';

function userWith(slug: string, permissions: string[] = []): Pick<AuthUser, 'role'> {
  return { role: { id: 'role-1', name: slug, slug, permissions } };
}

describe('resolveHomeDashboard', () => {
  it('resolves each of the four known role slugs to its own dashboard', () => {
    expect(resolveHomeDashboard(userWith('administrator'))).toBe(AdminHome);
    expect(resolveHomeDashboard(userWith('group_leader'))).toBe(GroupLeaderHome);
    expect(resolveHomeDashboard(userWith('scan_reviewer'))).toBe(ScanReviewerHome);
    expect(resolveHomeDashboard(userWith('subscriber'))).toBe(LearnerHome);
  });

  it('is case-insensitive', () => {
    expect(resolveHomeDashboard(userWith('GROUP_LEADER'))).toBe(GroupLeaderHome);
    expect(resolveHomeDashboard(userWith('Administrator'))).toBe(AdminHome);
  });

  it('a role matching none of the four gets the learner home, never the admin one', () => {
    expect(resolveHomeDashboard(userWith('some_future_role'))).toBe(LearnerHome);
    expect(resolveHomeDashboard(userWith('some_future_role'))).not.toBe(AdminHome);
  });

  it('a missing or empty role slug also gets the learner home', () => {
    expect(resolveHomeDashboard(undefined)).toBe(LearnerHome);
    expect(resolveHomeDashboard(null)).toBe(LearnerHome);
    expect(resolveHomeDashboard(userWith(''))).toBe(LearnerHome);
  });

  it('a role outside the table holding full access gets the administrator home', () => {
    // `superadmin` is the live example: it exists in the roles collection, it
    // is in no list of the four seeded accounts, and it holds every
    // permission. A slug-only table sent it to the learner home while its own
    // sidebar still offered group administration.
    expect(resolveHomeDashboard(userWith('superadmin', ['full-access', 'admin:full-access']))).toBe(
      AdminHome,
    );
    expect(resolveHomeDashboard(userWith('some_future_admin', ['admin:full-access']))).toBe(
      AdminHome,
    );
    expect(resolveHomeDashboard(userWith('some_future_admin', ['full-access']))).toBe(AdminHome);
  });

  it('full access outranks a slug that would otherwise pick a narrower dashboard', () => {
    expect(resolveHomeDashboard(userWith('subscriber', ['full-access']))).toBe(AdminHome);
    expect(resolveHomeDashboard(userWith('group_leader', ['admin:full-access']))).toBe(AdminHome);
  });

  it('an ordinary permission is not mistaken for full access', () => {
    expect(resolveHomeDashboard(userWith('group_leader', ['read:group', 'edit:group']))).toBe(
      GroupLeaderHome,
    );
    expect(resolveHomeDashboard(userWith('unknown_role', ['group:full-access']))).toBe(LearnerHome);
  });
});
