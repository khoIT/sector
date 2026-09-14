import { z } from 'zod';

/**
 * Reading one lesson/topic/quiz body — `GET /api/lms/courses/:courseId/lessons/:lessonId`,
 * `GET /api/lms/topics/:topicId`, `GET /api/lms/quizzes/:quizId`
 * (`gusi_nodejs_api/src/app/lms/lms.controller.ts`, `getLessonDetail` /
 * `getTopicDetail` / `getQuizDetail`).
 *
 * These are the one legacy (`v1`) read surface this phase still calls: the
 * Phase 6 outline resolves the ORDER and STATUS of every item but carries no
 * body content, and `v2/learners` has no per-item content route of its own.
 * Both handlers build a much larger `LessonData`/`TopicData` object (nested
 * `topics`/`quizzes` arrays, counts, slugs, timestamps) that exists to feed
 * the legacy dashboard's own tree re-derivation — the one thing this phase
 * was told to stop doing, because the Phase 6 outline already IS that tree.
 * Only `id`/`title`/`content`/`status` is parsed here; every other key the
 * route sends is silently dropped by these schemas rather than modelled.
 */

export const courseContentBodySchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  /** Reported by the route from `UserCourseProgress`, but the Phase 6
   *  outline item for the same id is the value this app actually renders
   *  from (it is fetched first and kept in sync by the track mutations) —
   *  this field exists on the schema only because the route always sends
   *  it, not because a caller reads it. */
  status: z.string().optional(),
});
export type CourseContentBody = z.infer<typeof courseContentBodySchema>;

const QUESTION_ANSWER_OPTION_SCHEMA = z.object({
  id: z.string(),
  title: z.string(),
  mediaUrl: z.string().nullish(),
  allowHtml: z.boolean().optional(),
});

/**
 * `answerType` stays `z.string()`, not a closed enum: see the identical
 * decision (and its evidence — a real `sort_answer` course-quiz question) in
 * `schemas/course-progress.ts`'s doc comment on `quizAttemptAnswerSchema`.
 */
export const courseQuizQuestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().nullish(),
  answerType: z.string(),
  answers: z.array(QUESTION_ANSWER_OPTION_SCHEMA),
  correctMessage: z.string().nullish(),
  incorrectMessage: z.string().nullish(),
  points: z.number().optional(),
});
export type CourseQuizQuestion = z.infer<typeof courseQuizQuestionSchema>;

export const courseQuizDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().nullish(),
  questions: z.array(courseQuizQuestionSchema),
});
export type CourseQuizDetail = z.infer<typeof courseQuizDetailSchema>;
