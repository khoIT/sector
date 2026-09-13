import { z } from 'zod';

/**
 * Group scan-notification preferences — per GROUP, not per account.
 *
 * Verified against `gusi_prod_mirror.groupnotifications` (a local, read-only
 * mirror of production): thousands of documents, one per (user, group) pair,
 * each shaped `{ user, group, emailNotifications, notificationTypes }`,
 * spread across several hundred distinct leaders and several hundred distinct
 * groups. Modelling this per-account instead would turn every leader's first
 * save into a duplicate document racing the real one, which is why the API
 * keys everything off `groupId` in the path rather than off the caller alone.
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
 *
 * `type` is `.nullish()`, not `.string()`: `Group.type` is `required: false`
 * with no schema default (`group.model.ts`), so Mongoose leaves the path
 * unset on hydration and it is absent from the JSON entirely — verified
 * against `gusi_prod_mirror.groups`, where 391 of 1,519 documents have no
 * `type` at all. `description`, `expirationDate` and `totalSeats` DO carry
 * schema defaults, so a document missing them in storage still hydrates with
 * the default value rather than an absent key; none of the three is rendered
 * here, so none is modelled.
 */
export const groupWithNotificationPreferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  type: z.string().nullish(),
  parent: z.string().nullable(),
  notificationsEnabled: z.boolean(),
  notificationTypes: z.array(notificationTypeSchema).default([]),
});

export type GroupWithNotificationPreference = z.infer<typeof groupWithNotificationPreferenceSchema>;

export const groupNotificationPreferenceListSchema = z.array(groupWithNotificationPreferenceSchema);

/**
 * `PUT /api/group-notifications/:groupId` body. `notificationTypes` is
 * optional on the wire, and the server KEEPS the stored list when it is
 * omitted (the field is simply left out of the Mongo update). The card relies
 * on that: `GET /api/group-notifications` only reveals `notificationTypes`
 * for a currently-enabled row (`getGroupsByUserWithNotifications` filters on
 * `emailNotifications: true`), so a disabled row's `[]` is not the real
 * stored list — sending it back on re-enable would overwrite the real list
 * with nothing. The card omits `notificationTypes` on exactly that
 * enable-from-disabled transition; every other write sends the full set it is
 * showing, since that is the one case where what is on screen is trustworthy.
 */
export const updateGroupNotificationPreferencePayloadSchema = z.object({
  enableNotification: z.boolean(),
  notificationTypes: z.array(notificationTypeSchema).optional(),
});

export type UpdateGroupNotificationPreferencePayload = z.infer<
  typeof updateGroupNotificationPreferencePayloadSchema
>;
