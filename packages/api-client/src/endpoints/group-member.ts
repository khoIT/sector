import type { ApiClient } from '../client';
import { paginatedSchema, type Paginated } from '../envelope';
import { DEFAULT_PAGE_SIZE } from '../list-query';
import { groupMemberSchema, type GroupMember } from '../schemas/group-member';

/**
 * Group-member-list endpoints.
 *
 * Two routes, matching the same split as `endpoints/group.ts` — see the
 * scoping note on `GROUP_ADMIN_BYPASS_PERMISSIONS` in `schemas/group.ts`.
 * `react/use-group-members.ts` is the only caller that decides between them.
 */
export type GroupMemberListQuery = {
  /**
   * Matched against the member's name/email/username on the server — but
   * only on `getAnyGroupMembers` (`GET /api/group-members`) today.
   * `getLedGroupMembers` (`GET /api/groups/manage/member/:groupId`) accepts
   * and validates this param, but its handler
   * (`manager.controller.ts#getGroupMembers`) never forwards it to the
   * query — `if (query.keyword) { … }` with no body, verified in
   * `gusi_nodejs_api` — so a group leader's or scan reviewer's search
   * silently matches every member until that ships (fix pending on a
   * separate API branch). Keep sending it regardless: it already works for
   * a full-access caller, and starts working here the moment the server
   * catches up, with no client change needed.
   */
  keyword?: string;
  page?: number;
  limit?: number;
};

const paginatedGroupMemberSchema = paginatedSchema(groupMemberSchema);

function groupMemberListParams(query: GroupMemberListQuery) {
  return {
    page: String(query.page ?? 1),
    limit: String(query.limit ?? DEFAULT_PAGE_SIZE),
    ...(query.keyword?.trim() ? { keyword: query.keyword.trim() } : {}),
  };
}

/**
 * GET /api/group-members?groupId=... — takes any groupId with no ownership
 * check at all: `group-member.controller.ts#getGroupMembers` never calls
 * `assertLeadsGroup`. Requires `read:group-member`, which every group role
 * holds, so this must only ever be called for a full-access caller.
 */
export async function getAnyGroupMembers(
  client: ApiClient,
  groupId: string,
  query: GroupMemberListQuery = {},
  signal?: AbortSignal,
): Promise<Paginated<GroupMember>> {
  return client.get('/api/group-members', {
    query: { groupId, ...groupMemberListParams(query) },
    schema: paginatedGroupMemberSchema,
    signal,
  });
}

/**
 * GET /api/groups/manage/member/:groupId — scoped server-side via
 * `assertLeadsGroup(userId, groupId, userRole)`, the leader-scoping
 * invariant (a group's members are readable by whoever holds an active
 * `GroupMember.role = 'leader'` row on that group or one of its ancestors):
 * 403s unless the caller leads `groupId` or an ancestor, or holds
 * `admin:full-access`. The one to feed a group leader's or scan reviewer's
 * members surface from. Guarded only by `authUser` at the route level — the
 * leadership check above is the access control, not a permission string. See
 * the `keyword` doc on `GroupMemberListQuery` for this route's search caveat.
 */
export async function getLedGroupMembers(
  client: ApiClient,
  groupId: string,
  query: GroupMemberListQuery = {},
  signal?: AbortSignal,
): Promise<Paginated<GroupMember>> {
  return client.get(`/api/groups/manage/member/${groupId}`, {
    query: groupMemberListParams(query),
    schema: paginatedGroupMemberSchema,
    signal,
  });
}
