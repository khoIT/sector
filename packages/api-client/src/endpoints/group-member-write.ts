import type { ApiClient } from '../client';
import { inviteGroupMemberResultSchema } from '../schemas/group-member-write';
import type {
  AddExistingUserToGroupPayload,
  InviteGroupMemberPayload,
  InviteGroupMemberResult,
  ReInviteGroupMemberPayload,
  UpdateGroupMemberRolePayload,
} from '../schemas/group-member-write';

/**
 * The write side of group membership. See the module doc on
 * `schemas/group-member-write.ts` for why this is the `/api/group-members`
 * family and not the `/api/groups/manage/member/:groupId` pair.
 */

/** POST /api/group-members/invite — requires `create:group-member`. */
export async function inviteGroupMember(
  client: ApiClient,
  payload: InviteGroupMemberPayload,
): Promise<InviteGroupMemberResult> {
  return client.post('/api/group-members/invite', {
    body: payload,
    schema: inviteGroupMemberResultSchema,
  });
}

/**
 * POST /api/group-members/add-existing-user — requires `create:group-member`.
 * The response is a `GroupMember.toObject()` this form does not need to
 * inspect: it invalidates and refetches the member list instead, same as
 * `updateGroupNotificationPreference`.
 */
export async function addExistingUserToGroup(
  client: ApiClient,
  payload: AddExistingUserToGroupPayload,
): Promise<void> {
  await client.post('/api/group-members/add-existing-user', { body: payload });
}

/** POST /api/group-members/re-invite — requires `create:group-member`. */
export async function reInviteGroupMember(
  client: ApiClient,
  payload: ReInviteGroupMemberPayload,
): Promise<void> {
  await client.post('/api/group-members/re-invite', { body: payload });
}

/**
 * PUT /api/group-members/:id — requires `edit:group-member`.
 *
 * Takes the group-MEMBER id (`GroupMember.id`, from the members list), not a
 * user id — verified against `updateGroupMemberByIdSchema`, which validates
 * only `params.id`.
 */
export async function updateGroupMemberRole(
  client: ApiClient,
  groupMemberId: string,
  payload: UpdateGroupMemberRolePayload,
): Promise<void> {
  await client.put(`/api/group-members/${groupMemberId}`, { body: payload });
}

/** DELETE /api/group-members/:id — requires `delete:group-member`. */
export async function removeGroupMember(client: ApiClient, groupMemberId: string): Promise<void> {
  await client.del(`/api/group-members/${groupMemberId}`);
}
