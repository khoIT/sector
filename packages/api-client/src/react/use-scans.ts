import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getScanById, getScanList, getScanUserGroups, getScanUsers } from '../endpoints/scan';
import type { Paginated } from '../envelope';
import type { ListQueryInput, ScanListFilterKey } from '../list-query';
import { scanKeys, type ScanListView } from '../query-keys';
import { hasProcessingScan, PROCESSING_POLL_MS } from '../scan-status';
import type { Scan } from '../schemas/scan';
import { useApiClient } from './api-provider';

export type UseScanListOptions = {
  view: ScanListView;
  /**
   * Debounce `globalFilter` with LIST_SEARCH_DEBOUNCE_MS BEFORE passing it, so
   * typing does not put a new key in the cache on every keystroke.
   */
  filters?: ListQueryInput<ScanListFilterKey>;
  enabled?: boolean;
  /**
   * Re-poll every 5s while any row is still `processing`. Server-side render
   * and de-identification finish seconds after the upload, so without this a
   * freshly uploaded scan sits on "Processing" until a manual refresh.
   */
  pollWhileProcessing?: boolean;
};

export function useScanList({
  view,
  filters = {},
  enabled = true,
  pollWhileProcessing = true,
}: UseScanListOptions) {
  const client = useApiClient();

  return useQuery<Paginated<Scan>>({
    queryKey: scanKeys.list(view, filters),
    queryFn: ({ signal }) => getScanList(client, view, filters, signal),
    enabled,
    // Keep the previous page on screen while the next one loads so the table
    // does not collapse to a spinner on every page change.
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      pollWhileProcessing && hasProcessingScan(query.state.data?.items)
        ? PROCESSING_POLL_MS
        : false,
  });
}

export type UseScanOptions = {
  view: ScanListView;
  scanId: string | undefined;
  enabled?: boolean;
};

export function useScan({ view, scanId, enabled = true }: UseScanOptions) {
  const client = useApiClient();

  return useQuery<Scan>({
    queryKey: scanKeys.detail(view, scanId ?? ''),
    queryFn: ({ signal }) => getScanById(client, view, scanId as string, signal),
    enabled: enabled && Boolean(scanId),
  });
}

/** Filter-dropdown source: users who own scans in the pending/reviewed bucket. */
export function useScanUsers(type: 'pending' | 'reviewed', enabled = true) {
  const client = useApiClient();

  return useQuery({
    queryKey: scanKeys.users(type),
    queryFn: ({ signal }) => getScanUsers(client, type, signal),
    enabled,
    // 1334 rows on the local database and it barely changes. Do not refetch it
    // on every filter-panel open.
    staleTime: 5 * 60 * 1000,
  });
}

/** Filter-dropdown source: the caller's own groups. */
export function useScanUserGroups(enabled = true) {
  const client = useApiClient();

  return useQuery({
    queryKey: scanKeys.userGroups(),
    queryFn: ({ signal }) => getScanUserGroups(client, signal),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
