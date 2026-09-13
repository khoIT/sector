import { describe, expect, it } from 'vitest';

import { AdminHome } from './admin-home';
import { GroupLeaderHome } from './group-leader-home';
import { LearnerHome } from './learner-home';
import { resolveHomeDashboard } from './resolve-home-dashboard';
import { ScanReviewerHome } from './scan-reviewer-home';

describe('resolveHomeDashboard', () => {
  it('resolves each of the four known role slugs to its own dashboard', () => {
    expect(resolveHomeDashboard('administrator')).toBe(AdminHome);
    expect(resolveHomeDashboard('group_leader')).toBe(GroupLeaderHome);
    expect(resolveHomeDashboard('scan_reviewer')).toBe(ScanReviewerHome);
    expect(resolveHomeDashboard('subscriber')).toBe(LearnerHome);
  });

  it('is case-insensitive', () => {
    expect(resolveHomeDashboard('GROUP_LEADER')).toBe(GroupLeaderHome);
    expect(resolveHomeDashboard('Administrator')).toBe(AdminHome);
  });

  it('a role matching none of the four gets the learner home, never the admin one', () => {
    expect(resolveHomeDashboard('some_future_role')).toBe(LearnerHome);
    expect(resolveHomeDashboard('some_future_role')).not.toBe(AdminHome);
  });

  it('a missing or empty role slug also gets the learner home', () => {
    expect(resolveHomeDashboard(undefined)).toBe(LearnerHome);
    expect(resolveHomeDashboard(null)).toBe(LearnerHome);
    expect(resolveHomeDashboard('')).toBe(LearnerHome);
  });
});
