import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createGroup, getGroupById, updateGroup } from '../endpoints/group-write';
import { groupKeys, mutationKeys } from '../query-keys';
import type { CreateGroupPayload, UpdateGroupPayload } from '../schemas/group-write';
import { useApiClient } from './api-provider';

/** Create a group. Invalidates the index so the new row shows up. */
export function useCreateGroupMutation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.createGroup(),
    mutationFn: (payload: CreateGroupPayload) => createGroup(client, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.listRoot() });
    },
  });
}

/** Edit a group. Invalidates the index row and this group's own detail views. */
export function useUpdateGroupMutation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.updateGroup(),
    mutationFn: ({ groupId, payload }: { groupId: string; payload: UpdateGroupPayload }) =>
      updateGroup(client, groupId, payload),
    onSuccess: (_result, { groupId }) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.listRoot() });
      void queryClient.invalidateQueries({
        queryKey: groupKeys.list({ scope: 'byId', groupId }),
      });
    },
  });
}

/** GET /api/groups/:id — feeds the edit form / settings tab. */
export function useGroupById(groupId: string | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: groupKeys.list({ scope: 'byId', groupId }),
    queryFn: () => getGroupById(client, groupId as string),
    enabled: Boolean(groupId),
  });
}
