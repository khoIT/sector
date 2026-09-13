import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getAllGroups, getLedGroups, type GroupListQuery } from '../endpoints/group';
import { groupKeys } from '../query-keys';
import { hasAnyPermission, type AuthUser } from '../schemas/auth';
import { GROUP_ADMIN_BYPASS_PERMISSIONS } from '../schemas/group';
import { useApiClient } from './api-provider';

export type UseGroupsOptions = {
  /**
   * The signed-in user. Read here, not in the page, so the endpoint choice
   * cannot drift between two call sites — see the scoping note on
   * `GROUP_ADMIN_BYPASS_PERMISSIONS` in `schemas/group.ts`.
   */
  user: AuthUser | null;
  query?: GroupListQuery;
  enabled?: boolean;
};

/** The groups index: every group a full-access caller may see, or the led
 *  groups (plus descendants) everyone else may see. One hook, two routes. */
export function useGroups({ user, query = {}, enabled = true }: UseGroupsOptions) {
  const client = useApiClient();
  const isFullAccess = hasAnyPermission(user, [...GROUP_ADMIN_BYPASS_PERMISSIONS]);

  return useQuery({
    queryKey: groupKeys.list({ scope: isFullAccess ? 'all' : 'led', ...query }),
    queryFn: ({ signal }) =>
      isFullAccess ? getAllGroups(client, query, signal) : getLedGroups(client, query, signal),
    enabled,
    // Keep the previous page visible while a keyword or page change is in
    // flight, so the table does not collapse to a spinner on every keystroke.
    placeholderData: keepPreviousData,
  });
}
