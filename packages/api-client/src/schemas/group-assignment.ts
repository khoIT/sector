import { z } from 'zod';

import { userBasicSchema } from './common';

/**
 * Group assignments — content (course/module/topic/quiz) assigned to specific
 * members of a group, with a due date. A real, separate domain in the API
 * (`/api/group-assignment`, `group-assignment.controller.ts`), not the
 * whole-group course enrolment `endpoints/group-course.ts` manages.
 *
 * Scoped to COURSE-level assignments only. The API also supports assigning a
 * single module, topic or quiz (`assignmentType: 'module' | 'topic' |
 * 'quiz'`), each needing its own content picker sourced from
 * `GET /group-assignment/course-details`'s nested lesson/topic/quiz tree.
 * That picker is a real, separate piece of work — course-level assignment is
 * what a group leader creating an assignment does most, and lesson/topic/quiz
 * assignment is left for the surface that actually browses a course's
 * structure (course authoring, not group administration).
 */
export const groupAssignmentTypeSchema = z.enum(['course', 'module', 'topic', 'quiz']);
export const groupAssignmentStatusSchema = z.enum([
  'draft',
  'active',
  'in_progress',
  'completed',
  'cancelled',
]);

/** `GET /group-assignment/learners?groupId=` — active learners eligible to be assigned. */
export const groupLearnerSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  email: z.string(),
  firstName: z.string().nullish(),
  middleName: z.string().nullish(),
  lastName: z.string().nullish(),
});

export type GroupLearner = z.infer<typeof groupLearnerSchema>;

/** `GET /group-assignment/group-courses?groupId=` — the group's own courses, for the picker. */
export const groupCourseOptionSchema = z.object({
  courseId: z.string(),
  courseTitle: z.string(),
});

export type GroupCourseOption = z.infer<typeof groupCourseOptionSchema>;

/**
 * `GET /group-assignment/group/:groupId` list item.
 *
 * `user` is modelled as `string | UserBasic` — the same defensive shape
 * CONTRACTS.md documents for `scannotes[].user` — because
 * `groupAssignmentService.getAll(..., { populate: true })`'s populated paths
 * are not yet verified closely enough to assert `user` is always the full
 * document rather than a bare id on every code path. Narrowing this to
 * `userBasicSchema` alone risks throwing on a shape this client has not
 * actually seen.
 */
export const groupAssignmentSchema = z.object({
  id: z.string(),
  assignmentType: groupAssignmentTypeSchema,
  courseId: z.union([z.string(), z.object({ id: z.string(), title: z.string() })]).nullish(),
  user: z.union([z.string(), userBasicSchema]),
  dueDate: z.string().nullish(),
  status: groupAssignmentStatusSchema,
  completedAt: z.string().nullish(),
  createdAt: z.string().optional(),
});

export type GroupAssignment = z.infer<typeof groupAssignmentSchema>;

/**
 * `POST /group-assignment` — course-level, single or bulk (`userIds`).
 * `contentRefModel` is always `'V2Course'` here because `assignmentType` is
 * pinned to `'course'` — see the module doc comment for why the other three
 * are out of scope.
 */
export const createGroupAssignmentPayloadSchema = z.object({
  group: z.string().min(1),
  courseId: z.string().min(1, 'Choose a course'),
  userIds: z.array(z.string()).min(1, 'Choose at least one learner'),
  dueDate: z.string().optional(),
});

export type CreateGroupAssignmentPayload = z.infer<typeof createGroupAssignmentPayloadSchema>;
