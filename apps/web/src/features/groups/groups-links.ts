/**
 * URLs for the group-administration surfaces, kept in one file so the index
 * page, the members surface, the router and the nav entry cannot drift apart
 * — same pattern as `scan-detail-links.ts`.
 *
 * `GROUP_ADMINISTRATION_PATH` and the `'nav.groupAdministration'` label key
 * are pinned deliberately: they are the identifiers `unbuilt-surfaces.ts`
 * carried for this section before it had a real page behind it, and
 * `shell/nav-config.ts` / `shell/nav-config.test.ts` still key off them.
 */
export const GROUP_ADMINISTRATION_PATH = '/administer/groups';

/** One group's members surface. */
export function groupMembersPathFor(groupId: string): string {
  return `${GROUP_ADMINISTRATION_PATH}/${groupId}/members`;
}

function stripLeadingSlash(path: string): string {
  return path.replace(/^\//, '');
}

/** Route path for the groups index, relative to the app root. */
export const GROUPS_INDEX_ROUTE_PATH = stripLeadingSlash(GROUP_ADMINISTRATION_PATH);

/** Route path for the members surface, relative to the app root. */
export const GROUP_MEMBERS_ROUTE_PATH = `${GROUPS_INDEX_ROUTE_PATH}/:groupId/members`;
