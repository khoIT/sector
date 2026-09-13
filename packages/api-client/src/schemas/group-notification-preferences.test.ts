import { describe, expect, it } from 'vitest';

import {
  groupNotificationPreferenceListSchema,
  groupNotificationPreferenceSchema,
} from './group-notification-preferences';

/**
 * Fixtures shaped like real `gusi_prod_mirror.groupnotifications` documents
 * (read via `mongosh --quiet gusi_prod_mirror`) merged onto the group fields
 * `getAllGroupsWithNotifications` spreads in — not invented shapes.
 */
describe('groupWithNotificationPreferenceSchema', () => {
  it('parses a led group with an active preference', () => {
    const parsed = groupNotificationPreferenceListSchema.parse([
      {
        id: '681a59c3c5a226f3463cb40e',
        name: 'Memorial Hospital of Gulfport MS IMRP 2025-26',
        slug: 'memorial-hospital-of-gulfport-fmrp_parent-1749714214398-memorial-hospital-of-gulfport-ms-imrp-2025-26',
        type: 'class',
        parent: '681a5828c5a226f3463caaa6',
        deletedAt: null,
        createdAt: '2025-05-06T18:49:39.915Z',
        updatedAt: '2025-09-20T00:25:46.888Z',
        notificationsEnabled: true,
        notificationTypes: ['scan_created', 'scan_submitted'],
      },
    ])[0]!;

    expect(parsed.parent).toBe('681a5828c5a226f3463caaa6');
    expect(parsed.notificationTypes).toEqual(['scan_created', 'scan_submitted']);
  });

  it('reads a top-level group (no parent) with no preference document yet', () => {
    // getAllGroupsWithNotifications: `notification?.notificationTypes || []`
    // when the leader has never saved a preference for this group.
    const parsed = groupNotificationPreferenceListSchema.parse([
      {
        id: 'g1',
        name: 'Root Group',
        slug: 'root-group',
        type: 'group',
        parent: null,
        notificationsEnabled: false,
        notificationTypes: [],
      },
    ])[0]!;

    expect(parsed.parent).toBeNull();
    expect(parsed.notificationsEnabled).toBe(false);
    expect(parsed.notificationTypes).toEqual([]);
  });

  it('parses an empty array for a caller who leads no group', () => {
    expect(groupNotificationPreferenceListSchema.parse([])).toEqual([]);
  });

  it('drops group fields the card does not render, rather than rejecting them', () => {
    const parsed = groupNotificationPreferenceListSchema.parse([
      {
        id: 'g1',
        name: 'Group',
        slug: 'group',
        type: 'group',
        parent: null,
        notificationsEnabled: true,
        notificationTypes: ['scan_failed'],
        description: '',
        isFreeTrial: false,
        totalSeats: 0,
        scanReviewers: [],
      },
    ])[0]!;

    expect(parsed).not.toHaveProperty('description');
  });
});

describe('groupNotificationPreferenceSchema', () => {
  it('parses the PUT response — the stored preference document, not the group', () => {
    const parsed = groupNotificationPreferenceSchema.parse({
      id: 'pref-1',
      user: 'user-1',
      group: '681a59c3c5a226f3463cb40e',
      emailNotifications: true,
      notificationTypes: ['scan_created', 'scan_submitted', 'scan_reviewed', 'scan_failed'],
      createdAt: '2025-06-18T17:52:19.232Z',
      updatedAt: '2025-06-18T17:52:19.232Z',
    });

    expect(parsed.notificationTypes).toHaveLength(4);
  });
});
