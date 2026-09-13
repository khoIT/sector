import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getGroupNotificationPreferences,
  updateGroupNotificationPreference,
} from '../endpoints/group-notification-preferences';
import { mutationKeys, notificationPreferenceKeys } from '../query-keys';
import type {
  GroupNotificationPreference,
  GroupWithNotificationPreference,
  UpdateGroupNotificationPreferencePayload,
} from '../schemas/group-notification-preferences';
import { useApiClient } from './api-provider';

/** The led-groups list. Empty for a caller who leads nothing — the card renders nothing then. */
export function useGroupNotificationPreferences(enabled = true) {
  const client = useApiClient();

  return useQuery<GroupWithNotificationPreference[]>({
    queryKey: notificationPreferenceKeys.list(),
    queryFn: ({ signal }) => getGroupNotificationPreferences(client, signal),
    enabled,
  });
}

/**
 * Not optimistic on purpose: a leader toggling this rarely does it twice in a
 * row, and refetching the one small list this invalidates is cheaper than
 * reconciling a partial update against `notificationTypes` if the write fails.
 */
export function useUpdateGroupNotificationPreferenceMutation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<
    GroupNotificationPreference,
    Error,
    { groupId: string; payload: UpdateGroupNotificationPreferencePayload }
  >({
    mutationKey: mutationKeys.updateGroupNotificationPreference(),
    mutationFn: ({ groupId, payload }) =>
      updateGroupNotificationPreference(client, groupId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationPreferenceKeys.list() });
    },
  });
}
