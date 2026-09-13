import type { AuthUser } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { COURSES_PATH } from '@/features/courses/courses-links';
import { GROUP_ADMINISTRATION_PATH } from '@/features/groups/groups-links';
import { SCAN_VAULT_PATH } from '@/features/scan-list/scan-list-views';

import { firstVisibleNavItem, shellTitleKeyFor, visibleNavGroups } from './nav-config';

/**
 * The rail now carries destinations that are not scan lists, so the two things
 * that used to be the same question are separate: whether a role may see an
 * entry, and where that entry points.
 *
 * Permission sets are the real ones, copied from POST /api/login against the
 * local gusi_dev database (see auth/demo-account-access.test.ts for the full
 * account-by-account table). `reviewed-only` is the exception: no seeded demo
 * account holds `view:scan:reviewed` without `view:scan:pending`, but the
 * server grants them separately and the Scan Vault landing rule exists for
 * exactly that combination, so it is pinned here.
 */

/** Only the fields the nav model reads. */
function userWithPermissions(name: string, permissions: string[]): AuthUser {
  return {
    id: `id-${name}`,
    email: `${name}@scanvault.test`,
    userName: name,
    role: { id: `role-${name}`, name, permissions },
  } as AuthUser;
}

const LEARNER = userWithPermissions('learner', ['create:scan', 'view:scan']);

const LEADER = userWithPermissions('leader', [
  'create:scan',
  'view:scan',
  'view:scan:pending',
  'view:scan:reviewed',
  // The seeded group_leader role's actual group permissions (POST
  // /api/login, local gusi_dev) — 'administer' now gates on the real
  // read:group rather than a borrowed scan permission.
  'view:group',
  'read:group',
]);

const REVIEWED_ONLY = userWithPermissions('reviewed-only', ['view:scan', 'view:scan:reviewed']);

function itemIds(user: AuthUser | null, groupId: string): string[] {
  const group = visibleNavGroups(user).find((candidate) => candidate.id === groupId);
  return group ? group.items.map((item) => item.id) : [];
}

describe('destinations that are not scan lists', () => {
  it('puts an ungated section in the rail with the URL the router mounted', () => {
    expect(itemIds(LEARNER, 'learn')).toEqual(['courses', 'gallery', 'sage', 'question-banks']);

    const courses = visibleNavGroups(LEARNER)
      .flatMap((group) => group.items)
      .find((item) => item.id === 'courses');
    expect(courses?.path).toBe(COURSES_PATH);
    expect(courses?.labelKey).toBe('nav.courses');
  });

  it('hides a gated section from a role without the permission, and shows it to one with it', () => {
    expect(itemIds(LEARNER, 'administer')).toEqual([]);
    expect(itemIds(LEADER, 'administer')).toEqual(['group-administration']);
  });

  it('drops the whole section rather than rendering a heading with nothing under it', () => {
    const learnerGroups = visibleNavGroups(LEARNER).map((group) => group.id);
    expect(learnerGroups).not.toContain('administer');
    expect(learnerGroups).toEqual(['home', 'scan-vault', 'learn']);

    for (const group of visibleNavGroups(LEARNER)) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it('lands every role on the home dashboard, not inside the Scan Vault', () => {
    // `/` no longer redirects into a scan list — it renders the role's own
    // dashboard (HomeRoute), so Home is the first destination for every role.
    expect(firstVisibleNavItem(LEARNER)?.path).toBe('/');
    expect(firstVisibleNavItem(LEADER)?.path).toBe('/');
  });

  it('names the section in the topbar heading', () => {
    expect(shellTitleKeyFor(COURSES_PATH)).toBe('nav.courses');
    expect(shellTitleKeyFor(GROUP_ADMINISTRATION_PATH)).toBe('nav.groupAdministration');
  });
});

describe('the Scan Vault landing rule', () => {
  it('points Group Scans at the reviewed list when the queue is out of reach', () => {
    const items = visibleNavGroups(REVIEWED_ONLY).flatMap((group) => group.items);
    const groupScans = items.find((item) => item.id === 'group-scans');

    expect(groupScans).toBeDefined();
    expect(groupScans?.path).toBe(SCAN_VAULT_PATH.reviewed);
  });

  it('drops Group Scans when neither list is readable', () => {
    expect(itemIds(LEARNER, 'scan-vault')).toEqual(['my-scans', 'shared-scans']);
  });

  it('keeps badges keyed to the entry they belong to', () => {
    const items = visibleNavGroups(LEADER, { 'group-scans': 3 }).flatMap((group) => group.items);

    expect(items.find((item) => item.id === 'group-scans')?.badge).toBe(3);
    expect(items.find((item) => item.id === 'courses')?.badge).toBeUndefined();
  });
});
