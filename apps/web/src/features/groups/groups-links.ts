/**
 * URLs for the group-administration surfaces, kept in one file so the index
 * page, the members surface, the router and the nav entry cannot drift apart
 * — same pattern as `scan-detail-links.ts`.
 *
 * `GROUP_ADMINISTRATION_PATH` and the `'nav.groupAdministration'` label key
 * are pinned deliberately: they are the identifiers `unbuilt-surfaces.ts`
 * carried for this section before it had a real page behind it, and
 * `shell/nav-config.ts` / `shell/nav-config.test.ts` still key off them.
 *
 * One group has FIVE tabs once the write slice lands: members (the existing
 * default landing tab), courses, assignments, exports and settings. Each is
 * its own route rather than one page switching on client state, so every tab
 * is deep-linkable and the cold-load sweep can open each on its own.
 */
export const GROUP_ADMINISTRATION_PATH = '/administer/groups';

export type GroupDetailTab = 'members' | 'courses' | 'assignments' | 'exports' | 'settings';

function groupTabPathFor(groupId: string, tab: GroupDetailTab): string {
  return `${GROUP_ADMINISTRATION_PATH}/${groupId}/${tab}`;
}

/** One group's members surface — the default landing tab. */
export function groupMembersPathFor(groupId: string): string {
  return groupTabPathFor(groupId, 'members');
}

/** One group's course roster (whole-group enrolment, not per-member assignment). */
export function groupCoursesPathFor(groupId: string): string {
  return groupTabPathFor(groupId, 'courses');
}

/** One group's per-member assignments. */
export function groupAssignmentsPathFor(groupId: string): string {
  return groupTabPathFor(groupId, 'assignments');
}

/** One group's exports (scans, course progress, completion report). */
export function groupExportsPathFor(groupId: string): string {
  return groupTabPathFor(groupId, 'exports');
}

/** One group's edit form and scan-notification preferences. */
export function groupSettingsPathFor(groupId: string): string {
  return groupTabPathFor(groupId, 'settings');
}

function stripLeadingSlash(path: string): string {
  return path.replace(/^\//, '');
}

/** Route path for the groups index, relative to the app root. */
export const GROUPS_INDEX_ROUTE_PATH = stripLeadingSlash(GROUP_ADMINISTRATION_PATH);

/** Route path for the members surface, relative to the app root. */
export const GROUP_MEMBERS_ROUTE_PATH = `${GROUPS_INDEX_ROUTE_PATH}/:groupId/members`;

/** Route path for the group-courses surface, relative to the app root. */
export const GROUP_COURSES_ROUTE_PATH = `${GROUPS_INDEX_ROUTE_PATH}/:groupId/courses`;

/** Route path for the group-assignments surface, relative to the app root. */
export const GROUP_ASSIGNMENTS_ROUTE_PATH = `${GROUPS_INDEX_ROUTE_PATH}/:groupId/assignments`;

/** Route path for the group-exports surface, relative to the app root. */
export const GROUP_EXPORTS_ROUTE_PATH = `${GROUPS_INDEX_ROUTE_PATH}/:groupId/exports`;

/** Route path for the group-settings surface, relative to the app root. */
export const GROUP_SETTINGS_ROUTE_PATH = `${GROUPS_INDEX_ROUTE_PATH}/:groupId/settings`;
