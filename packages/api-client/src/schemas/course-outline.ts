import { z } from 'zod';

import { courseItemProgressStatusSchema, courseProgressStatusSchema } from './course';

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
 * `resume: null`. Re-checked after `feat/sector-course-outline` merged into
 * the branch `:5002` runs, same day: `resume` now names a leaf (a quiz or a
 * topic, never a lesson) on every in-progress course sampled, `progress`
 * arrives a whole percent (`29`, not `28.915662650602407`), and `totalItems`
 * correctly excludes a `blockedReason` item from the denominator — verified
 * against five different enrolled courses with a blocked item, e.g.
 * `681a4b82779a0d9e6c9cc605` (9 items, 1 blocked, `totalItems: 8`).
 *
 * `progress` stays a plain `z.number()` rather than tightening to an integer
 * schema: a number is a number, and the client should keep accepting either
 * shape rather than re-coupling itself to today's exact wire precision.
 * `resume.kind` stays the shared `courseOutlineItemKindSchema` (all three
 * kinds) for the same reason — a lesson is still a legal resume target for
 * the edge case where a lesson genuinely has no leaf under it, even though
 * no sampled course exercises that case today.
 *
 * `resume` is the server's SUGGESTION, not a guarantee that the item can be
 * opened: the route's own selection filters on "not completed" and "is a
 * leaf" but not on `blockedReason`, so it can name a quiz with no questions.
 * Callers resolve it through `resolveResumeTarget` (apps/web) rather than
 * trusting it directly.
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
  /**
   * The item's OWN stored status, which is the four-value set — a quiz
   * answered in full below its passing mark is stored `failed` and served
   * `failed`. The course-level `status` below is derived by the route from
   * these and can only be one of the three.
   */
  status: courseItemProgressStatusSchema,
  completedAt: z.string().nullable(),
  lastAccessedAt: z.string().nullable(),
  blockedReason: courseOutlineBlockedReasonSchema.nullable(),
  /** Populated for `kind: 'quiz'` only; `null` for a lesson or a topic. */
  quiz: courseOutlineQuizSummarySchema.nullable(),
  /**
   * Where this learner's playhead was, in seconds — the resume point. `null`
   * for anything that is not a topic with a video, and for a video topic the
   * learner has never opened.
   */
  positionSeconds: z.number().nullable(),
  /**
   * Runtime in seconds, from the server's Vimeo metadata cache. `null` when
   * the topic has no video AND when Vimeo would not describe it: 43 videos in
   * the library are private, and the outline shows no runtime rather than a
   * wrong one.
   */
  durationSeconds: z.number().nullable(),
  /** Poster frame from the same cache, `null` for the same two reasons. */
  imageUrl: z.string().nullable(),
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
   *
   * Nullable, because the controller deliberately reports null rather than
   * claim precision it does not have: a progress row with no recorded
   * `courseMetaVersionNumber` (the legacy shape) and a pinned version whose
   * snapshot has since been deleted both resolve a structure without
   * resolving a version number. Read it as "this outline was not resolved
   * from a pinned version", not as "no version exists".
   */
  courseMetaVersion: z.number().nullable(),
  status: courseProgressStatusSchema,
  progress: z.number(),
  totalItems: z.number(),
  completedItems: z.number(),
  resume: courseOutlineResumeSchema.nullable(),
  items: z.array(courseOutlineItemSchema),
});
export type CourseOutline = z.infer<typeof courseOutlineSchema>;
