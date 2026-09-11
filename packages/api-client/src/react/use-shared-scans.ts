import { useQuery } from '@tanstack/react-query';

import { getSharedScanList } from '../endpoints/shared-scan-list';
import type { Paginated } from '../envelope';
import type { ListQueryInput, SharedScanListFilterKey } from '../list-query';
import { sharedScanKeys } from '../query-keys';
import type { SharedScanListItem } from '../schemas/shared-scan-list';
import { useApiClient } from './api-provider';

export type UseSharedScanListOptions = {
  /**
   * Debounce `globalFilter` with LIST_SEARCH_DEBOUNCE_MS BEFORE passing it, so
   * typing does not put a new key in the cache on every keystroke.
   */
  filters?: ListQueryInput<SharedScanListFilterKey>;
  enabled?: boolean;
};

/** Scans shared WITH the signed-in user, matched on their email server-side. */
export function useSharedScanList({
  filters = {},
  enabled = true,
}: UseSharedScanListOptions = {}) {
  const client = useApiClient();

  return useQuery<Paginated<SharedScanListItem>>({
    queryKey: sharedScanKeys.list(filters),
    queryFn: ({ signal }) => getSharedScanList(client, filters, signal),
    enabled,
  });
}
