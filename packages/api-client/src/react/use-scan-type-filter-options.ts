import { useQuery } from '@tanstack/react-query';

import { getScanTypeFilterOptions } from '../endpoints/scan-type-filter';
import { scanTypeKeys } from '../query-keys';
import { useApiClient } from './api-provider';

/**
 * Scan-type options for the list filter. The catalogue changes about once a
 * release, so it is cached for the session rather than refetched every time a
 * filter panel opens.
 */
export function useScanTypeFilterOptions(enabled = true) {
  const client = useApiClient();

  return useQuery({
    queryKey: scanTypeKeys.filterOptions(),
    queryFn: ({ signal }) => getScanTypeFilterOptions(client, signal),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
}
