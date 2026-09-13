import { z } from 'zod';

import { courseProgressStatusSchema } from './course';

/**
 * The resolved course outline — GET /api/v2/learners/courses/:courseId/outline.
 *
 * One ordered, flat item list with per-item status, prev/next and a resume
 * pointer, replacing the four places the legacy client re-derived navigation
 * (route generation, breadcrumbs, the Resume button, the sidebar). Nothing
 * here re-traverses or re-sorts `items`: `order` is the order, and the
 * client's only job is to render it and to group it visually by
 * `lessonId`/`depth`.
 *
 * Checked against several of the seeded learner's own courses on the
 * production mirror (`learner@sector.test`, `:5002`), 14 Sep 2026, including
 * one at 200 items with a zero-question quiz and one completed course with
 * `resume: null`.
 *
 * Two respects in which the running `:5002` instance still disagrees with
 * this contract, while another branch finishes the fix — both are values
 * this schema already accepts, so nothing here special-cases either one:
 *   - `resume` today points at the enclosing LESSON on every in-progress
 *     course rather than the first leaf beneath it; the contract is a leaf,
 *     `kind` is shared with every other item, and a lesson is a legal `kind`
 *     for the rare case where a lesson genuinely has no leaf under it, so no
 *     narrower type would be honest here anyway.
 *   - `progress` arrives an unrounded float (e.g. `28.915662650602407`); the
 *     contract is a whole percent. `z.number()` accepts both — round for
 *     display, not in the schema.
 *   - `totalItems` on at least one course (`692c752d6c39e6299557e3cb`, 200
 *     items) still counts a `blockedReason` item in the denominator; the
 *     contract excludes it. The count is a plain `z.number()` either way.
 */

export const COURSE_OUTLINE_ITEM_KINDS = ['lesson', 'topic', 'quiz'] as const;
export const courseOutlineItemKindSchema = z.enum(COURSE_OUTLINE_ITEM_KINDS);
export type CourseOutlineItemKind = z.infer<typeof courseOutlineItemKindSchema>;

/**
 * The one blocked reason observed and documented: a published quiz with zero
 * non-deleted questions (146 such quizzes system-wide per the plan this
 * route implements). Modelled as an enum rather than a bare string literal
 * so a second reason is a type-checked addition, not a silent string typo.
 */
export const COURSE_OUTLINE_BLOCKED_REASONS = ['quiz_has_no_questions'] as const;
export const courseOutlineBlockedReasonSchema = z.enum(COURSE_OUTLINE_BLOCKED_REASONS);
export type CourseOutlineBlockedReason = z.infer<typeof courseOutlineBlockedReasonSchema>;

/**
 * `bestPercentage`/`passed` are `null` until the first attempt — verified on
 * an unattempted quiz (`attempts: 0`) on the seeded learner's own courses.
 * `questionCount` is the same bar `blockedReason` reports on: zero here is
 * why the item is blocked, not a separate signal.
 */
export const courseOutlineQuizSummarySchema = z.object({
  questionCount: z.number(),
  attempts: z.number(),
  bestPercentage: z.number().nullable(),
  passed: z.boolean().nullable(),
});
export type CourseOutlineQuizSummary = z.infer<typeof courseOutlineQuizSummarySchema>;

export const courseOutlineItemSchema = z.object({
  id: z.string(),
  kind: courseOutlineItemKindSchema,
  title: z.string(),
  order: z.number(),
  depth: z.number(),
  parentId: z.string().nullable(),
  lessonId: z.string().nullable(),
  topicId: z.string().nullable(),
  prevId: z.string().nullable(),
  nextId: z.string().nullable(),
  status: courseProgressStatusSchema,
  completedAt: z.string().nullable(),
  lastAccessedAt: z.string().nullable(),
  blockedReason: courseOutlineBlockedReasonSchema.nullable(),
  /** Populated for `kind: 'quiz'` only; `null` for a lesson or a topic. */
  quiz: courseOutlineQuizSummarySchema.nullable(),
});
export type CourseOutlineItem = z.infer<typeof courseOutlineItemSchema>;

/** A leaf to open — a topic or a quiz — or `null` once nothing remains. */
export const courseOutlineResumeSchema = z.object({
  itemId: z.string(),
  kind: courseOutlineItemKindSchema,
});
export type CourseOutlineResume = z.infer<typeof courseOutlineResumeSchema>;

export const courseOutlineSchema = z.object({
  courseId: z.string(),
  /**
   * A bare version NUMBER on this route — unlike the object of the same
   * field name on the My Courses item (`learnerCourseMetaVersionSummarySchema`
   * in `./course.ts`). Do not reuse one type for both.
   */
  courseMetaVersion: z.number(),
  status: courseProgressStatusSchema,
  progress: z.number(),
  totalItems: z.number(),
  completedItems: z.number(),
  resume: courseOutlineResumeSchema.nullable(),
  items: z.array(courseOutlineItemSchema),
});
export type CourseOutline = z.infer<typeof courseOutlineSchema>;
