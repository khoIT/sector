import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  addExistingUserToGroup,
  inviteGroupMember,
  reInviteGroupMember,
  removeGroupMember,
  updateGroupMemberRole,
} from '../endpoints/group-member-write';
import { groupKeys, mutationKeys } from '../query-keys';
import type {
  AddExistingUserToGroupPayload,
  InviteGroupMemberPayload,
  ReInviteGroupMemberPayload,
  UpdateGroupMemberRolePayload,
} from '../schemas/group-member-write';
import { useApiClient } from './api-provider';

/** Every membership write invalidates the SAME roster, by groupId. */
function useInvalidateMembers(groupId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: groupKeys.membersRoot(groupId) });
}

export function useInviteGroupMemberMutation(groupId: string) {
  const client = useApiClient();
  const invalidate = useInvalidateMembers(groupId);

  return useMutation({
    mutationKey: mutationKeys.inviteGroupMember(),
    mutationFn: (payload: InviteGroupMemberPayload) => inviteGroupMember(client, payload),
    onSuccess: invalidate,
  });
}

export function useAddExistingUserToGroupMutation(groupId: string) {
  const client = useApiClient();
  const invalidate = useInvalidateMembers(groupId);

  return useMutation({
    mutationKey: mutationKeys.addExistingUserToGroup(),
    mutationFn: (payload: AddExistingUserToGroupPayload) => addExistingUserToGroup(client, payload),
    onSuccess: invalidate,
  });
}

export function useReInviteGroupMemberMutation() {
  const client = useApiClient();

  return useMutation({
    mutationKey: mutationKeys.reInviteGroupMember(),
    mutationFn: (payload: ReInviteGroupMemberPayload) => reInviteGroupMember(client, payload),
  });
}

export function useUpdateGroupMemberRoleMutation(groupId: string) {
  const client = useApiClient();
  const invalidate = useInvalidateMembers(groupId);

  return useMutation({
    mutationKey: mutationKeys.updateGroupMemberRole(),
    mutationFn: ({
      groupMemberId,
      payload,
    }: {
      groupMemberId: string;
      payload: UpdateGroupMemberRolePayload;
    }) => updateGroupMemberRole(client, groupMemberId, payload),
    onSuccess: invalidate,
  });
}

export function useRemoveGroupMemberMutation(groupId: string) {
  const client = useApiClient();
  const invalidate = useInvalidateMembers(groupId);

  return useMutation({
    mutationKey: mutationKeys.removeGroupMember(),
    mutationFn: (groupMemberId: string) => removeGroupMember(client, groupMemberId),
    onSuccess: invalidate,
  });
}
