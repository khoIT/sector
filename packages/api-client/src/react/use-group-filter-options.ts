import { useQuery } from '@tanstack/react-query';

import {
  getGroupFilterOptions,
  type GroupFilterOptionsQuery,
} from '../endpoints/group-filter-options';
import { groupKeys } from '../query-keys';
import { useApiClient } from './api-provider';

/**
 * Groups the caller may filter a list by.
 *
 * The keyword goes to the SERVER: the unscoped answer runs to 1,476 groups on
 * the local database, so filtering only what one page happened to load would
 * hide most of them behind a search box that appears to work.
 *
 * `placeholderData: keepPreviousData` in spirit is not used — the list is
 * small and a brief "Loading…" while a keyword lands is honest.
 */
export function useGroupFilterOptions(query: GroupFilterOptionsQuery, enabled = true) {
  const client = useApiClient();

  return useQuery({
    queryKey: groupKeys.filterOptions(query.keyword ?? '', query.page ?? 1),
    queryFn: ({ signal }) => getGroupFilterOptions(client, query, signal),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
