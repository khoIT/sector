import type { ApiClient } from '../client';
import {
  groupNotificationPreferenceListSchema,
  type GroupWithNotificationPreference,
  type UpdateGroupNotificationPreferencePayload,
} from '../schemas/group-notification-preferences';

/**
 * A group leader's own scan-notification preferences, one row per group led.
 *
 * Both routes are scoped to the caller by `req.user.id` server-side and both
 * re-check leadership on every call (`getGroupMemberByUserIdAndGroupId(...).role
 * !== LEADER` throws 403), so there is no group id a non-leader can pass here
 * to read or write someone else's setting.
 */

/** GET /api/group-notifications. Empty array for a caller who leads no group. */
export async function getGroupNotificationPreferences(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<GroupWithNotificationPreference[]> {
  return client.get('/api/group-notifications', {
    schema: groupNotificationPreferenceListSchema,
    signal,
  });
}

/**
 * PUT /api/group-notifications/:groupId.
 *
 * The route answers the saved preference document with `user` and `group`
 * POPULATED to `{id, userName, email, firstName, lastName}` and
 * `{id, name, slug, description, type}` respectively
 * (`populateGroupNotification` in `group-notification.service.ts`) — nothing
 * this card renders. Parsing a shape nobody reads back would only add a way
 * for an unrelated drift in those nested documents to fail a save that
 * otherwise succeeded, so the response is discarded and the card invalidates
 * + refetches the list instead.
 */
export async function updateGroupNotificationPreference(
  client: ApiClient,
  groupId: string,
  payload: UpdateGroupNotificationPreferencePayload,
  signal?: AbortSignal,
): Promise<void> {
  await client.put(`/api/group-notifications/${groupId}`, {
    body: payload,
    signal,
  });
}
