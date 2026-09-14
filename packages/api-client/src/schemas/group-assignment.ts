import { z } from 'zod';

import { assignmentContentRefSchema } from './assignment';
import { userBasicSchema } from './common';

/**
 * Group assignments — content (course/module/topic/quiz) assigned to specific
 * members of a group, with a due date. A real, separate domain in the API
 * (`/api/group-assignment`, `group-assignment.controller.ts`), not the
 * whole-group course enrolment `endpoints/group-course.ts` manages.
 *
 * READING is all four assignment types. WRITING, from this client, is
 * course-level only: assigning a single module, topic or quiz needs a content
 * picker over `GET /group-assignment/course-details`'s nested tree, which
 * belongs to a surface that browses a course's structure. The read side does
 * not inherit that limit, and must not — on the production mirror only 376 of
 * 8,734 assignment rows are course-level, and the group the cold-load sweep
 * uses (`6a6ae3d759ab84398c7cee4f`) has 1,367 assignments of which zero are.
 * Filtering the list to `assignmentType=course` made that group's tab report
 * "no assignments yet", which is a false statement rather than a missing
 * feature.
 */
// The assignment type and status vocabularies are declared once, beside the
// read model in ./assignment, and imported here. They were written twice while
// the read and write sides were built in parallel; the values were identical,
// so this keeps the single copy rather than two that can drift apart.
export { groupAssignmentStatusSchema, groupAssignmentTypeSchema } from './assignment';
import { groupAssignmentStatusSchema, groupAssignmentTypeSchema } from './assignment';

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
 * Now modelled against the live route rather than guessed at. The controller
 * passes `{ populate: true }`, so `groupAssignmentService`'s default populate
 * paths always apply: `user` and `author` become
 * `{id, userName, email, firstName, lastName}`, `contentId` becomes the FULL
 * content document, and `courseId`/`lessonId`/`topicId` become
 * `{id, title, slug}`. A bare id is therefore NOT a shape this route can
 * return, and the old `string | UserBasic` union defended against the wrong
 * thing.
 *
 * `user` is nullable because a populate whose target document is missing
 * yields `null`, not an id — 14 of 18 rows on mirror group
 * `68790e75c39d8b562b939d5f` come back with `user: null`. On the mirror that
 * is an artifact of its partial `users` collection (1,070 of 1,461 assignee
 * ids are not in it), so this is not evidence of orphaned rows in production;
 * it IS evidence that one unresolvable reference must not take the whole tab
 * down, which is what a non-nullable `user` did.
 *
 * `contentId` is what the row is actually FOR. It is the populated document,
 * of whichever type `contentRefModel` names, and is reduced here to the two
 * fields the list renders — extra keys are dropped by a non-strict
 * `z.object`, not rejected. Without it the list could only say who and when,
 * never what.
 */
export const groupAssignmentSchema = z.object({
  id: z.string(),
  assignmentType: groupAssignmentTypeSchema,
  /** The assigned course/module/topic/quiz itself. */
  contentId: assignmentContentRefSchema.nullish(),
  /** The course the content sits under; null on a bare course assignment. */
  courseId: assignmentContentRefSchema.nullish(),
  user: userBasicSchema.nullish(),
  dueDate: z.string().nullish(),
  status: groupAssignmentStatusSchema,
  completedAt: z.string().nullish(),
  assignedAt: z.string().optional(),
  createdAt: z.string().optional(),
});

export type GroupAssignment = z.infer<typeof groupAssignmentSchema>;

/**
 * `POST /group-assignment` — course-level, single or bulk (`userIds`).
 * `contentRefModel` is always `'V2Course'` here because `assignmentType` is
 * pinned to `'course'` — see the module doc comment for why the other three
 * are out of scope for the WRITE side. The list above reads all four.
 */
export const createGroupAssignmentPayloadSchema = z.object({
  group: z.string().min(1),
  courseId: z.string().min(1, 'Choose a course'),
  userIds: z.array(z.string()).min(1, 'Choose at least one learner'),
  dueDate: z.string().optional(),
});

export type CreateGroupAssignmentPayload = z.infer<typeof createGroupAssignmentPayloadSchema>;
