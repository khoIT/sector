import { z } from 'zod';

import { userBasicSchema } from './common';

/**
 * Group assignments: what a group leader (or an administrator) assigned a
 * learner to complete — a course, a module (lesson), a topic or a quiz.
 *
 * Read-only in Sector: the surface here is `GET /api/group-assignment` (list,
 * for one group), matching what the legacy `manage-group/:groupId/assignments`
 * page showed a leader. Create/edit/delete are NOT ported — they pull in a
 * much larger content-reference picker (course/lesson/topic/quiz, bulk
 * assignment to many learners) that this phase's scope does not cover, and
 * porting a write path nobody can exercise from a read-only page is worse
 * than not having it.
 *
 * `contentId` is NOT `{id, title}` on the wire, despite what the legacy
 * dashboard's Zod object claimed (never `.parse()`d, so nobody noticed): it is
 * the FULL populated content document — course, lesson, topic or quiz,
 * whichever `contentRefModel` names — with dozens of fields the assignments
 * table never shows. Modelled here as `{id, title}` deliberately: extra keys
 * are dropped by a non-strict `z.object`, not rejected, so parsing succeeds
 * and the table gets exactly the two fields it renders. Verified against the
 * local production mirror, 2026-09-14, for a `module` / `V2Lesson` row; `title`
 * is assumed present on the other three content types too since all four v2
 * content models carry it as a required field.
 */
export const GROUP_ASSIGNMENT_TYPES = ['course', 'module', 'topic', 'quiz'] as const;
export const groupAssignmentTypeSchema = z.enum(GROUP_ASSIGNMENT_TYPES);
export type GroupAssignmentType = z.infer<typeof groupAssignmentTypeSchema>;

export const GROUP_ASSIGNMENT_STATUSES = [
  'draft',
  'active',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export const groupAssignmentStatusSchema = z.enum(GROUP_ASSIGNMENT_STATUSES);
export type GroupAssignmentStatus = z.infer<typeof groupAssignmentStatusSchema>;

export const assignmentGroupRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type AssignmentGroupRef = z.infer<typeof assignmentGroupRefSchema>;

/** The course/lesson/topic/quiz an assignment points at — see the module doc comment. */
export const assignmentContentRefSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export type AssignmentContentRef = z.infer<typeof assignmentContentRefSchema>;

export const assignmentSchema = z.object({
  id: z.string(),
  group: assignmentGroupRefSchema,
  user: userBasicSchema,
  assignmentType: groupAssignmentTypeSchema,
  contentId: assignmentContentRefSchema,
  /** Set when the assignment targets something under a course (module/topic/quiz); null for a bare course assignment. */
  courseId: assignmentContentRefSchema.nullish(),
  lessonId: assignmentContentRefSchema.nullish(),
  topicId: assignmentContentRefSchema.nullish(),
  assignedAt: z.string(),
  completedAt: z.string().nullable(),
  dueDate: z.string().nullish(),
  status: groupAssignmentStatusSchema,
});

export type Assignment = z.infer<typeof assignmentSchema>;

/**
 * GET /api/group-assignment response envelope. NOT `Paginated<T>` — this
 * route predates that shape and was never migrated, so its pagination object
 * carries different field names (`total`/`skip`/`hasMore` vs `totalItems`/
 * `page`/`totalPages`).
 */
export const assignmentListResponseSchema = z.object({
  assignments: z.array(assignmentSchema),
  pagination: z.object({
    total: z.number(),
    skip: z.number(),
    limit: z.number(),
    hasMore: z.boolean(),
  }),
});

export type AssignmentListResponse = z.infer<typeof assignmentListResponseSchema>;
