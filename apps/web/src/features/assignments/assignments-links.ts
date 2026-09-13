import { GROUP_ADMINISTRATION_PATH } from '@/features/groups/groups-links';

/**
 * One group's assignments surface — pinned by `app/legacy-route-map.ts`'s
 * `SECTOR_PATH.groupAssignments`, which the legacy
 * `/dashboard/manage-group/:groupId/assignments` redirect already targets.
 * Do not change this segment without changing it there too.
 *
 * Nested under group administration (phase 8's surface) rather than under
 * `/learn`: this is what a group leader or administrator assigns a LEARNER
 * to do, the same audience as the members surface at
 * `groupMembersPathFor`, not a learner-facing page.
 */
export function groupAssignmentsPathFor(groupId: string): string {
  return `${GROUP_ADMINISTRATION_PATH}/${groupId}/assignments`;
}

function stripLeadingSlash(path: string): string {
  return path.replace(/^\//, '');
}

const GROUPS_INDEX_ROUTE_PATH = stripLeadingSlash(GROUP_ADMINISTRATION_PATH);

/** Route path for one group's assignments, relative to the app root. */
export const GROUP_ASSIGNMENTS_ROUTE_PATH = `${GROUPS_INDEX_ROUTE_PATH}/:groupId/assignments`;
