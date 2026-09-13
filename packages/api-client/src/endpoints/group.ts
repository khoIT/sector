import type { ApiClient } from '../client';
import { paginatedSchema, type Paginated } from '../envelope';
import { DEFAULT_PAGE_SIZE } from '../list-query';
import { groupSchema, type Group } from '../schemas/group';

/**
 * Group-index endpoints.
 *
 * Two routes, not one — see the scoping note on `GROUP_ADMIN_BYPASS_PERMISSIONS`
 * in `schemas/group.ts` for why. `react/use-groups.ts` is the only caller that
 * decides between them; nothing else in this package should import both.
 */
export type GroupListQuery = {
  /** Matched against the group name/slug, case-insensitively, on the server. */
  keyword?: string;
  page?: number;
  limit?: number;
};

const paginatedGroupSchema = paginatedSchema(groupSchema);

function groupListParams(query: GroupListQuery) {
  return {
    page: String(query.page ?? 1),
    limit: String(query.limit ?? DEFAULT_PAGE_SIZE),
    ...(query.keyword?.trim() ? { keyword: query.keyword.trim() } : {}),
  };
}

/**
 * GET /api/groups — every group in the system. No caller scoping: verified by
 * reading `group.controller.ts#getGroups`, whose Mongo query is built from
 * `keyword`/`type`/`parentId` only. Requires `read:group`, which every group
 * role holds, so calling this for anyone but a full-access caller would show a
 * group leader groups they do not lead.
 */
export async function getAllGroups(
  client: ApiClient,
  query: GroupListQuery = {},
  signal?: AbortSignal,
): Promise<Paginated<Group>> {
  return client.get('/api/groups', {
    query: groupListParams(query),
    schema: paginatedGroupSchema,
    signal,
  });
}

/**
 * GET /api/groups/manage — scoped server-side to the caller's led groups and
 * their descendants (`getLedGroupIdsWithDescendants`, CTP-307), unless the
 * caller holds `admin:full-access`. The one to feed a group leader's or scan
 * reviewer's index from.
 */
export async function getLedGroups(
  client: ApiClient,
  query: GroupListQuery = {},
  signal?: AbortSignal,
): Promise<Paginated<Group>> {
  return client.get('/api/groups/manage', {
    query: groupListParams(query),
    schema: paginatedGroupSchema,
    signal,
  });
}
