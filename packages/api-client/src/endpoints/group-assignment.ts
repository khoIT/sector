import { z } from 'zod';

import type { ApiClient } from '../client';
import { paginatedSchema } from '../envelope';
import {
  groupAssignmentSchema,
  groupCourseOptionSchema,
  groupLearnerSchema,
  myAssignmentsPageSchema,
} from '../schemas/group-assignment';
import type { CreateGroupAssignmentPayload, MyAssignmentsPage } from '../schemas/group-assignment';

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
 *
 * `read:group-assignment` is NOT an administrative permission. In the mirror's
 * `roles` collection it is held by `subscriber` and `scan reviewer` as well as
 * `group leader`, and NOT by `administrator` or `Superadmin`, who reach these
 * routes through `full-access` instead. So the permission cannot stand in for
 * "leads this group", and a comment claiming a bare subscriber lacks it —
 * there was one, on a route file since deleted — is worse than no comment.
 * Prefer the group-scoped read below; it is the only route in this domain that
 * checks anything about the caller's relationship to the group.
 *
 * There is also a LIST route, `GET /api/group-assignment?groupId=`, which
 * applies the permission and then filters on whatever `groupId` it is handed —
 * and returns every assignment in the product when handed none. This client
 * deliberately does not call it.
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

export type MyAssignmentsQuery = {
  /** Upper bound on the due date, as an ISO string. */
  dueDateTo?: string;
  /** Only rows past their due date and not yet completed. */
  isOverdue?: boolean;
  limit?: number;
};

/**
 * `GET /api/group-assignment/dashboard/user` — the CALLER's own assignments.
 *
 * No `userId` travels from the browser, by design: the server derives whose
 * dashboard this is from the session. Sending one is how a client asks for
 * someone else's, which the route authorises separately and which no
 * learner-facing surface should ever do.
 */
export async function getMyDashboardAssignments(
  client: ApiClient,
  query: MyAssignmentsQuery = {},
  signal?: AbortSignal,
): Promise<MyAssignmentsPage> {
  return client.get('/api/group-assignment/dashboard/user', {
    query: {
      ...(query.dueDateTo ? { dueDateTo: query.dueDateTo } : {}),
      // Sent as an explicit string: the route reads 'true'/'false' rather than
      // coercing, so that 'false' cannot arrive meaning "only overdue".
      ...(query.isOverdue === undefined ? {} : { isOverdue: String(query.isOverdue) }),
      ...(query.limit ? { limit: String(query.limit) } : {}),
    },
    schema: myAssignmentsPageSchema,
    signal,
  });
}
