import type { AuthUser } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { SCAN_VAULT_PATH } from '@/features/scan-list/scan-list-views';
import { UNBUILT_SURFACES } from '@/routes/unbuilt-surfaces';

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
]);

const REVIEWED_ONLY = userWithPermissions('reviewed-only', ['view:scan', 'view:scan:reviewed']);

function itemIds(user: AuthUser | null, groupId: string): string[] {
  const group = visibleNavGroups(user).find((candidate) => candidate.id === groupId);
  return group ? group.items.map((item) => item.id) : [];
}

describe('destinations that are not scan lists', () => {
  it('puts an ungated section in the rail with the URL the router mounted', () => {
    expect(itemIds(LEARNER, 'learn')).toEqual(['courses', 'question-banks']);

    const courses = visibleNavGroups(LEARNER)
      .flatMap((group) => group.items)
      .find((item) => item.id === 'courses');
    expect(courses?.path).toBe(UNBUILT_SURFACES.courses.path);
    expect(courses?.labelKey).toBe('nav.courses');
  });

  it('hides a gated section from a role without the permission, and shows it to one with it', () => {
    expect(itemIds(LEARNER, 'administer')).toEqual([]);
    expect(itemIds(LEADER, 'administer')).toEqual(['group-administration']);
  });

  it('drops the whole section rather than rendering a heading with nothing under it', () => {
    const learnerGroups = visibleNavGroups(LEARNER).map((group) => group.id);
    expect(learnerGroups).not.toContain('administer');
    expect(learnerGroups).toEqual(['scan-vault', 'learn']);

    for (const group of visibleNavGroups(LEARNER)) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it('leaves the landing surface inside the Scan Vault', () => {
    // `/` forwards to this. A section that has no page behind it yet must not
    // become the first thing an account sees.
    expect(firstVisibleNavItem(LEARNER)?.path).toBe(SCAN_VAULT_PATH.my);
    expect(firstVisibleNavItem(LEADER)?.path).toBe(SCAN_VAULT_PATH.my);
  });

  it('names the section in the topbar heading', () => {
    expect(shellTitleKeyFor(UNBUILT_SURFACES.courses.path)).toBe('nav.courses');
    expect(shellTitleKeyFor(UNBUILT_SURFACES['group-administration'].path)).toBe(
      'nav.groupAdministration',
    );
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
