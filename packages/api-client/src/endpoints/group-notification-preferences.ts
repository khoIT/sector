import type { ApiClient } from '../client';
import {
  groupNotificationPreferenceListSchema,
  groupNotificationPreferenceSchema,
  type GroupNotificationPreference,
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

/** PUT /api/group-notifications/:groupId. */
export async function updateGroupNotificationPreference(
  client: ApiClient,
  groupId: string,
  payload: UpdateGroupNotificationPreferencePayload,
  signal?: AbortSignal,
): Promise<GroupNotificationPreference> {
  return client.put(`/api/group-notifications/${groupId}`, {
    body: payload,
    schema: groupNotificationPreferenceSchema,
    signal,
  });
}
