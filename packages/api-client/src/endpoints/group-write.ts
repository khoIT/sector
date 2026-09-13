import type { ApiClient } from '../client';
import {
  groupWriteResultSchema,
  type CreateGroupPayload,
  type UpdateGroupPayload,
} from '../schemas/group-write';

/**
 * The caller validates with `createGroupPayloadSchema` / `updateGroupPayloadSchema`
 * before calling these — see `groups/forms/group-form-model.ts` — so the
 * payload here is already the validated shape, same convention as
 * `endpoints/scan-write.ts`.
 */

/** POST /api/groups — requires `create:group`. */
export async function createGroup(client: ApiClient, payload: CreateGroupPayload) {
  return client.post('/api/groups', { body: payload, schema: groupWriteResultSchema });
}

/** PUT /api/groups/:id — requires `edit:group`. */
export async function updateGroup(client: ApiClient, groupId: string, payload: UpdateGroupPayload) {
  return client.put(`/api/groups/${groupId}`, { body: payload, schema: groupWriteResultSchema });
}

/** GET /api/groups/:id — requires `read:group`. The edit form's own fetch, by id. */
export async function getGroupById(client: ApiClient, groupId: string) {
  return client.get(`/api/groups/${groupId}`, { schema: groupWriteResultSchema });
}
