import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  getAnyGroupMembers,
  getLedGroupMembers,
  type GroupMemberListQuery,
} from '../endpoints/group-member';
import { groupKeys } from '../query-keys';
import { hasAnyPermission, type AuthUser } from '../schemas/auth';
import { GROUP_ADMIN_BYPASS_PERMISSIONS } from '../schemas/group';
import { useApiClient } from './api-provider';

export type UseGroupMembersOptions = {
  /** See `UseGroupsOptions['user']` in `use-groups.ts` — same reasoning. */
  user: AuthUser | null;
  groupId: string | undefined;
  query?: GroupMemberListQuery;
  enabled?: boolean;
};

/** One group's member roster: the caller's own led-group route, or the
 *  unscoped one for a full-access caller. One hook, two routes. */
export function useGroupMembers({
  user,
  groupId,
  query = {},
  enabled = true,
}: UseGroupMembersOptions) {
  const client = useApiClient();
  const isFullAccess = hasAnyPermission(user, [...GROUP_ADMIN_BYPASS_PERMISSIONS]);

  return useQuery({
    queryKey: groupKeys.members(groupId ?? '', { scope: isFullAccess ? 'all' : 'led', ...query }),
    queryFn: ({ signal }) =>
      isFullAccess
        ? getAnyGroupMembers(client, groupId as string, query, signal)
        : getLedGroupMembers(client, groupId as string, query, signal),
    enabled: enabled && Boolean(groupId),
    placeholderData: keepPreviousData,
  });
}
