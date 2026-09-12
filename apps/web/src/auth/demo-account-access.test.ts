import type { AuthUser } from '@scanvault/api-client';
import { describe, expect, it } from 'vitest';

import { SCAN_VAULT_PATH } from '@/features/scan-list/scan-list-views';
import { visibleScanTabs, visibleScanViews } from '@/features/scan-list/tabs/scan-tab-model';
import { firstVisibleNavItem, visibleNavGroups } from '@/shell/nav-config';

/**
 * What each demo account may see, pinned to the REAL permission sets.
 *
 * The `view:scan*` arrays below are copied verbatim from POST /api/login
 * against the local gusi_dev database — they are the roles as seeded, not
 * invented fixtures. The observed server behaviour they correspond to, taken
 * from the same run:
 *
 *   account         my      shared   group unrev/rev   expert unrev/rev
 *   learner         5       1        403 / 403          403 / 403
 *   leader          0       0        2004 / 3068        403 / 403
 *   reviewer-solo   0       0        0    / 0           7    / 2967
 *   reviewer        0       0        2004 / 3068        7    / 2967
 *
 * So the two reviewer accounts carry IDENTICAL permissions and differ only in
 * data: reviewer-solo leads no group, which is why its group queues return 200
 * with zero rows rather than 403. Tab visibility must therefore be the same for
 * both — a role-driven UI must not hide a tab just because it is empty.
 */

/** Only the fields the tab and nav models read. */
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

const REVIEWER_PERMISSIONS = [
  'create:scan',
  'view:scan',
  'view:scan:pending',
  'view:scan:pending:expert',
  'view:scan:reviewed',
  'view:scan:reviewed:expert',
];

const REVIEWER = userWithPermissions('reviewer', REVIEWER_PERMISSIONS);
const REVIEWER_SOLO = userWithPermissions('reviewer-solo', REVIEWER_PERMISSIONS);

describe('demo account tab visibility', () => {
  it('gives a learner exactly two surfaces: their own scans and shares', () => {
    expect(visibleScanViews(LEARNER)).toEqual(['my', 'shared']);
    expect(visibleScanTabs(LEARNER).map((tab) => tab.labelKey)).toEqual([
      'nav.myScans',
      'nav.sharedScans',
    ]);
  });

  it('gives a group leader four surfaces, including both group lists', () => {
    expect(visibleScanViews(LEADER)).toEqual(['my', 'shared', 'pending', 'reviewed']);

    const group = visibleScanTabs(LEADER).find((tab) => tab.id === 'group');
    expect(group?.subTabs.map((sub) => sub.labelKey)).toEqual([
      'tabs.unreviewed',
      'tabs.reviewed',
    ]);
    // No expert permission, so the tab must not exist at all.
    expect(visibleScanTabs(LEADER).some((tab) => tab.id === 'expert')).toBe(false);
  });

  it('gives a scan reviewer all six surfaces, expert queues included', () => {
    expect(visibleScanViews(REVIEWER)).toEqual([
      'my',
      'shared',
      'pending',
      'reviewed',
      'expert',
      'expert-reviewed',
    ]);
  });

  it('shows the solo reviewer the same tabs as the group reviewer', () => {
    // reviewer-solo leads no group: its group queues are EMPTY, not forbidden.
    // Visibility is role-driven, so the tab set must be identical.
    expect(visibleScanViews(REVIEWER_SOLO)).toEqual(visibleScanViews(REVIEWER));
  });

  it('shows a signed-out visitor nothing but the ungated shared tab', () => {
    expect(visibleScanViews(null)).toEqual(['shared']);
  });
});

describe('sidebar navigation', () => {
  it('drops the group and expert entries for a learner', () => {
    const items = visibleNavGroups(LEARNER).flatMap((group) => group.items);
    expect(items.map((item) => item.id)).toEqual(['my-scans', 'shared-scans']);
  });

  it('keeps group but not expert for a leader, pointing at the unreviewed queue', () => {
    const items = visibleNavGroups(LEADER).flatMap((group) => group.items);
    expect(items.map((item) => item.id)).toEqual([
      'my-scans',
      'shared-scans',
      'group-scans',
    ]);
    expect(items.find((item) => item.id === 'group-scans')?.path).toBe(
      SCAN_VAULT_PATH.pending,
    );
  });

  it('lands every account on a surface it is actually allowed to open', () => {
    for (const user of [LEARNER, LEADER, REVIEWER, REVIEWER_SOLO]) {
      const landing = firstVisibleNavItem(user);
      expect(landing).toBeDefined();
      expect(visibleScanViews(user)).toContain(
        (Object.keys(SCAN_VAULT_PATH) as Array<keyof typeof SCAN_VAULT_PATH>).find(
          (view) => SCAN_VAULT_PATH[view] === landing?.path,
        ),
      );
    }
  });

  it('renders no empty nav heading when a group has no visible entries', () => {
    for (const group of visibleNavGroups(LEARNER)) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });
});
