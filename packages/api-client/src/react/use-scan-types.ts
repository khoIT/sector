import { useQuery } from '@tanstack/react-query';

import { getScanTypeItems } from '../endpoints/scan-type';
import { scanTypeKeys } from '../query-keys';
import type { ScanTypeItems } from '../schemas/scan-type';
import { useApiClient } from './api-provider';

/**
 * Findings rows + dynamic forms for one scan type.
 *
 * Definitions, not data: they change when an organization edits its forms,
 * which is roughly never inside one session, so they are held for an hour and
 * every scan of the same type shares one cache entry.
 */
export function useScanTypeItems(scanTypeId: string | undefined, enabled = true) {
  const client = useApiClient();

  return useQuery<ScanTypeItems>({
    queryKey: scanTypeKeys.items(scanTypeId ?? ''),
    queryFn: ({ signal }) => getScanTypeItems(client, scanTypeId as string, signal),
    enabled: enabled && Boolean(scanTypeId),
    staleTime: 60 * 60 * 1000,
  });
}
