import { z } from 'zod';

import type { ApiClient } from '../client';
import { paginatedSchema } from '../envelope';
import {
  groupAssignmentSchema,
  groupCourseOptionSchema,
  groupLearnerSchema,
} from '../schemas/group-assignment';
import type { CreateGroupAssignmentPayload } from '../schemas/group-assignment';

const paginatedGroupAssignmentSchema = paginatedSchema(groupAssignmentSchema);

/**
 * `/api/group-assignment` — a domain separate from `/api/groups/manage`.
 * Every route here is gated only by a `*_GROUP_ASSIGNMENT` permission with a
 * client-supplied `groupId`: `group-assignment.controller.ts` never calls
 * `assertLeadsGroup`. `getAssignmentsByGroupId` (used below) at least checks
 * the caller is an ACTIVE member of the group when they lack full access;
 * `getGroupLearners`, `getGroupCourses` and `createGroupAssignment` do not
 * check membership at all. That is a server gap, not something this client
 * can close — flagged, not worked around.
 */

/** GET /group-assignment/learners?groupId= — active learners eligible to be assigned. */
export async function getGroupLearners(client: ApiClient, groupId: string, keyword?: string) {
  return client.get('/api/group-assignment/learners', {
    query: { groupId, keyword },
    schema: z.array(groupLearnerSchema),
  });
}

/** GET /group-assignment/group-courses?groupId= — the group's own courses. */
export async function getGroupCourseOptions(client: ApiClient, groupId: string) {
  return client.get('/api/group-assignment/group-courses', {
    query: { groupId },
    schema: z.array(groupCourseOptionSchema),
  });
}

export type GetGroupAssignmentsQuery = {
  page?: number;
  limit?: number;
  courseId?: string;
};

/**
 * GET /group-assignment/group/:groupId — every assignment on this group,
 * whatever its type.
 *
 * Deliberately NOT filtered to `assignmentType=course`. It was, to match what
 * this client can create, and that made the list assert something false:
 * course-level rows are 376 of 8,734 on the production mirror, and the group
 * the sweep opens has 1,367 assignments and zero course-level ones, so the tab
 * said "no assignments yet" to a leader with 1,367 of them. A read surface
 * reports what exists; the write form says separately what it can add.
 *
 * `page` is 0-indexed here, unlike every other list route in this client —
 * `getAssignmentsByGroupId` computes `skip = page * limit` directly rather
 * than going through `getPagination`.
 */
export async function getAssignmentsForGroup(
  client: ApiClient,
  groupId: string,
  query: GetGroupAssignmentsQuery = {},
) {
  return client.get(`/api/group-assignment/group/${groupId}`, {
    query: {
      page: String(query.page ?? 0),
      limit: String(query.limit ?? 20),
      courseId: query.courseId,
    },
    schema: paginatedGroupAssignmentSchema,
  });
}

/** POST /group-assignment — requires `create:group-assignment`. Course-level, bulk by `userIds`. */
export async function createGroupAssignment(
  client: ApiClient,
  payload: CreateGroupAssignmentPayload,
): Promise<void> {
  await client.post('/api/group-assignment', {
    body: {
      group: payload.group,
      assignmentType: 'course',
      contentRefModel: 'V2Course',
      contentId: payload.courseId,
      courseId: payload.courseId,
      userIds: payload.userIds,
      dueDate: payload.dueDate,
    },
  });
}
