import type { ApiClient } from '../client';
import { groupFilterOptionsPageSchema, type GroupFilterOptionsPage } from '../schemas/group-filter';

export type GroupFilterOptionsQuery = {
  /** Matched against the group name, case-insensitively, on the server. */
  keyword?: string;
  page?: number;
  limit?: number;
};

/** GET /api/groups/filter-options — requires `read:group`. */
export async function getGroupFilterOptions(
  client: ApiClient,
  query: GroupFilterOptionsQuery = {},
  signal?: AbortSignal,
): Promise<GroupFilterOptionsPage> {
  return client.get('/api/groups/filter-options', {
    query: {
      page: String(query.page ?? 1),
      limit: String(query.limit ?? 50),
      ...(query.keyword?.trim() ? { keyword: query.keyword.trim() } : {}),
    },
    schema: groupFilterOptionsPageSchema,
    signal,
  });
}
