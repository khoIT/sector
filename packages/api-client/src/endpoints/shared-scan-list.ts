import type { ApiClient } from '../client';
import { paginatedSchema, type Paginated } from '../envelope';
import {
  buildListQuery,
  type ListQueryInput,
  type SharedScanListFilterKey,
} from '../list-query';
import {
  sharedScanListItemSchema,
  type SharedScanListItem,
} from '../schemas/shared-scan-list';

const paginatedSharedScanSchema = paginatedSchema(sharedScanListItemSchema);

/**
 * GET /api/shared-scans
 *
 * Takes a DIFFERENT filter set from the /api/scan/* lists — `sharedBy` and
 * `scanTypeIds` (ids!) rather than `userIds` and `scanTypeKeys` (keys). The
 * filter-key union is what keeps the two apart at compile time.
 */
export async function getSharedScanList(
  client: ApiClient,
  input: ListQueryInput<SharedScanListFilterKey> = {},
  signal?: AbortSignal,
): Promise<Paginated<SharedScanListItem>> {
  return client.get('/api/shared-scans', {
    query: buildListQuery(input),
    schema: paginatedSharedScanSchema,
    signal,
  });
}
