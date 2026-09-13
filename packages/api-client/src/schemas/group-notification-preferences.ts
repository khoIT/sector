import { z } from 'zod';

/**
 * Group scan-notification preferences — per GROUP, not per account.
 *
 * Verified against `gusi_prod_mirror.groupnotifications` (a local, read-only
 * mirror of production): 2,363 documents, one per (user, group) pair, each
 * shaped `{ user, group, emailNotifications, notificationTypes }`. 916 group
 * leaders own them across 554 groups. Modelling this per-account instead would
 * turn every leader's first save into a duplicate document racing the real
 * one, which is why the API keys everything off `groupId` in the path rather
 * than off the caller alone.
 */
export const NOTIFICATION_TYPES = [
  'scan_created',
  'scan_submitted',
  'scan_reviewed',
  'scan_failed',
] as const;

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/**
 * `GET /api/group-notifications` answers one entry per group the caller
 * LEADS (empty array for anyone who leads none), each a `Group.toObject()`
 * spread plus the two preference fields. `parent` comes back as a bare
 * ObjectId string here — `getGroupsByUserIdAndRole` populates `group` but not
 * `group.parent` — so it is NOT the populated `{id,name,slug}` shape that
 * `userGroupSchema` models for a different route. Fields beyond what the
 * notification card renders are dropped rather than guessed at.
 */
export const groupWithNotificationPreferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  type: z.string(),
  parent: z.string().nullable(),
  notificationsEnabled: z.boolean(),
  notificationTypes: z.array(notificationTypeSchema).default([]),
});

export type GroupWithNotificationPreference = z.infer<typeof groupWithNotificationPreferenceSchema>;

export const groupNotificationPreferenceListSchema = z.array(groupWithNotificationPreferenceSchema);

/**
 * `PUT /api/group-notifications/:groupId` body. `notificationTypes` is
 * optional on the wire (the server keeps the stored list when it is omitted),
 * but the card always sends the full set it is showing, so a toggle a user
 * just cleared cannot survive as a stale server default.
 */
export const updateGroupNotificationPreferencePayloadSchema = z.object({
  enableNotification: z.boolean(),
  notificationTypes: z.array(notificationTypeSchema).optional(),
});

export type UpdateGroupNotificationPreferencePayload = z.infer<
  typeof updateGroupNotificationPreferencePayloadSchema
>;

/** The stored preference document, as answered by the PUT route. */
export const groupNotificationPreferenceSchema = z.object({
  id: z.string(),
  user: z.string(),
  group: z.string(),
  emailNotifications: z.boolean(),
  notificationTypes: z.array(notificationTypeSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GroupNotificationPreference = z.infer<typeof groupNotificationPreferenceSchema>;
