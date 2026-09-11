import {
  SCAN_LIST_FILTER_KEYS,
  SHARED_SCAN_LIST_FILTER_KEYS,
  type ColumnFilter,
  type ScanListFilterKey,
  type SharedScanListFilterKey,
} from '@scanvault/api-client';

import type { FilterState } from './table/list-url-state';

/**
 * The URL carries filters as free-form `{id, value}` pairs, because a user can
 * type anything into the query string. These narrow them to the keys the
 * server actually recognises before they reach the API client.
 *
 * Dropping an unknown key matters: the scan routes take `scanTypeKeys` while
 * the shared-scan route takes `scanTypeIds`, and passing the wrong one is
 * silently ignored by the server — the list would come back unfiltered and
 * look like a bug in the filter panel.
 */
export function toScanColumnFilters(
  filters: FilterState[],
): Array<ColumnFilter<ScanListFilterKey>> {
  const allowed = new Set<string>(SCAN_LIST_FILTER_KEYS);
  return filters
    .filter((filter): filter is ColumnFilter<ScanListFilterKey> => allowed.has(filter.id))
    .map((filter) => ({ id: filter.id, value: filter.value }));
}

export function toSharedScanColumnFilters(
  filters: FilterState[],
): Array<ColumnFilter<SharedScanListFilterKey>> {
  const allowed = new Set<string>(SHARED_SCAN_LIST_FILTER_KEYS);
  return filters
    .filter((filter): filter is ColumnFilter<SharedScanListFilterKey> => allowed.has(filter.id))
    .map((filter) => ({ id: filter.id, value: filter.value }));
}
