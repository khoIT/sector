import { z } from 'zod';

import { courseProgressStatusSchema } from './course';

/**
 * Writing to a learner's course progress — `POST /api/v2/learners/courses/:courseId/track`,
 * `POST .../quizzes/:quizId/track`, `POST .../quizzes/:quizId/retake` and
 * `GET .../quizzes/progress` (`gusi_nodejs_api/src/app/lms/learners/learners.controller.ts`).
 *
 * This is the seam the phase's own risk note points at: Phase 6 left every
 * progress shape in `NOT_REPLAYED` because no production dump holds a
 * `usercourseprogresses` document (the mirror carries five, all synthetic,
 * written by `scripts/data/seed-course-progress.ts` driving this exact API).
 * There is no `z.any()` here — the server's own `QuizAttemptDocument` type
 * (`user-course-progress.model.ts`) types `answers: any[]`, but its writer
 * (`learners.quiz.track.ts#trackQuizAnswer`) only ever appends ONE shape, and
 * a real attempt produced by driving this API end-to-end and read back
 * straight off `gusi_prod_mirror.usercourseprogresses` on 14 Sep 2026 (course
 * `681a4b5b779a0d9e6c9cc52e`, three completed quiz items, 100% each) matches
 * it exactly — every field below is read off that live document, not guessed
 * from the server's own loose type.
 */

export const TRACK_CONTENT_TYPES = ['course', 'lesson', 'topic', 'quiz'] as const;
export const trackContentTypeSchema = z.enum(TRACK_CONTENT_TYPES);
export type TrackContentType = z.infer<typeof trackContentTypeSchema>;

/**
 * Request body for the course/lesson/topic/quiz "viewed" ping. There is no
 * `isCompleted` flag here on purpose — unlike the legacy v1
 * `POST /api/lms/create-user-progress` the reachable dashboard code still
 * calls, this v2 route (the one the Phase 6 outline actually reads back)
 * derives completion server-side from the course structure and, for a topic,
 * from `hasVideo`/`videoCompleted` — the client only reports what happened,
 * never what it thinks the result should be.
 */
export const trackCourseProgressPayloadSchema = z.object({
  contentType: trackContentTypeSchema,
  contentId: z.string(),
  timeSpent: z.number().optional(),
  hasVideo: z.boolean().optional(),
  videoCompleted: z.boolean().optional(),
});
export type TrackCourseProgressPayload = z.infer<typeof trackCourseProgressPayloadSchema>;

/**
 * The response echoes the full `UserCourseProgress`/`UserCourseActivity`
 * Mongoose documents (`{ progress, activity }`), computed and re-saved on
 * every call. Nothing in this app reads either: the caller invalidates and
 * refetches the Phase 6 outline instead, which is the resolved, typed shape
 * every screen already renders from — parsing a second, ad hoc echo of the
 * same mutable state here would just be re-deriving what the outline already
 * resolves, the exact thing this phase was told not to do. No schema is
 * declared for it; `client.post` is called without one, the same as
 * `scan-tags.ts` and `scan-reset-upload.ts` do for a write nothing reads back.
 */

/** Every selection is sent as an array regardless of answer type, same
 *  reasoning as the question-bank adapter (`adapters/bank.ts`): the server
 *  normalises a bare string into a one-element array itself. */
export const trackCourseQuizProgressPayloadSchema = z.object({
  questionId: z.string(),
  answerId: z.union([z.string(), z.array(z.string())]),
  dateTimeStarted: z.number(),
  dateTimeFinished: z.number(),
});
export type TrackCourseQuizProgressPayload = z.infer<typeof trackCourseQuizProgressPayloadSchema>;

/**
 * Response of `POST /quizzes/:quizId/track` — one question's grade, computed
 * per request from `learners.quiz.track.ts#trackQuizAnswer`. Never stored
 * under this exact shape (the stored shape is `quizAttemptAnswerSchema`
 * below, which carries answer TITLES this narrower echo does not); proved by
 * reading the handler's own `return` rather than by replay, the same
 * justification `questionBankResultQuestionSchema` uses for its bank
 * equivalent.
 */
export const trackCourseQuizProgressResultSchema = z.object({
  questionId: z.string(),
  questionTitle: z.string(),
  answerType: z.string(),
  selectedAnswerIds: z.array(z.string()),
  correctAnswerIds: z.array(z.string()),
  isCorrect: z.boolean(),
  points: z.number(),
  earnedPoints: z.number(),
  correctMessage: z.string().optional(),
  incorrectMessage: z.string().optional(),
  timeSpent: z.number(),
  quizCompleted: z.boolean(),
  quizScore: z.number().optional(),
  quizPassed: z.boolean().optional(),
  totalQuestions: z.number().optional(),
  answeredQuestions: z.number().optional(),
  courseStatus: courseProgressStatusSchema,
  courseProgress: z.number(),
});
export type TrackCourseQuizProgressResult = z.infer<typeof trackCourseQuizProgressResultSchema>;

/** Response of `POST /quizzes/:quizId/retake` — an echo of the fresh attempt
 *  it just opened, nothing stored under this shape either. */
export const retakeCourseQuizResultSchema = z.object({
  courseId: z.string(),
  quizId: z.string(),
  attemptNumber: z.number(),
  startedAt: z.string(),
});
export type RetakeCourseQuizResult = z.infer<typeof retakeCourseQuizResultSchema>;

/**
 * One answer inside a stored `quizAttempts[].answers[]` entry. Distinct from
 * `trackCourseQuizProgressResultSchema` above: this is what `finish()` reads
 * BACK to build the per-question review (it carries answer titles; the
 * per-call echo only carries ids), and it is what a real mirror document
 * holds, not what one POST response holds.
 *
 * `answerType` stays `z.string()` rather than the bank's closed
 * `z.enum(['single', 'multiple'])`: a real production course quiz
 * (`681a4f624bc509ae57597c83`, "US Guided LP Scanning Technique Quiz") holds
 * one `sort_answer` question, verified against `gusi_prod_mirror.v2questions`
 * on 14 Sep 2026 — the one Phase 5's own engine doc comment already accounts
 * for ("the server itself hard-codes [it] to `isCorrect = false`"). A closed
 * enum here would throw the whole quiz's result away for that one course.
 */
const quizAttemptAnswerRefSchema = z.object({
  title: z.string(),
  mediaUrl: z.string().optional(),
  allowHtml: z.boolean().optional(),
  id: z.string().optional(),
});

export const quizAttemptAnswerSchema = z.object({
  questionId: z.string(),
  title: z.string(),
  answerType: z.string(),
  isCorrect: z.boolean(),
  points: z.number(),
  earnedPoints: z.number(),
  correctAnswerIds: z.array(z.string()),
  correctAnswers: z.array(quizAttemptAnswerRefSchema),
  selectedAnswers: z.array(quizAttemptAnswerRefSchema),
  selectedAnswerIds: z.array(z.string()),
  answeredAt: z.string(),
});
export type QuizAttemptAnswer = z.infer<typeof quizAttemptAnswerSchema>;

/**
 * One `quizAttempts[]` entry. `score`/`percentageScore`/`totalPoints`/`passed`
 * are all schema-defaulted to `null` on the Mongoose side
 * (`QuizAttemptSchema` in `user-course-progress.model.ts`) until the attempt
 * completes — nullable here, not optional, matching that default exactly
 * rather than the wire-drift shortcut of just widening on first failure.
 */
export const quizAttemptSchema = z.object({
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  score: z.number().nullable(),
  percentageScore: z.number().nullable(),
  totalPoints: z.number().nullable(),
  passed: z.boolean().nullable(),
  timeSpent: z.number(),
  answers: z.array(quizAttemptAnswerSchema),
});
export type QuizAttempt = z.infer<typeof quizAttemptSchema>;

/**
 * An item's own status inside `GET .../quizzes/progress`. Deliberately a
 * SEPARATE schema from the course-level `courseProgressStatusSchema` (three
 * values): `learners.quiz.track.ts:263` sets a quiz item to `failed` when an
 * attempt completes below the passing mark — the same real fourth value the
 * course read-seam review (`code-reviewer-260914-0102-...-report.md`, B1)
 * found missing from the outline's item status. That schema is being
 * corrected on `fix/sector-course-shapes`; this one is new and independent,
 * so it is modelled against the real four-value `ProgressStatus` enum
 * (`user-course-progress.model.ts`) from the start rather than inheriting the
 * gap.
 */
export const QUIZ_ITEM_PROGRESS_STATUSES = [
  'not_started',
  'in_progress',
  'completed',
  'failed',
] as const;
export const quizItemProgressStatusSchema = z.enum(QUIZ_ITEM_PROGRESS_STATUSES);
export type QuizItemProgressStatus = z.infer<typeof quizItemProgressStatusSchema>;

const courseQuizProgressQuizRefSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  status: z.string(),
  isQbank: z.boolean().optional(),
});

export const courseQuizProgressEntrySchema = z.object({
  quizId: z.string(),
  quiz: courseQuizProgressQuizRefSchema.nullable(),
  path: z.string().nullable(),
  status: quizItemProgressStatusSchema,
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  lastAccessedAt: z.string().nullable(),
  timeSpent: z.number(),
  quizAttempts: z.array(quizAttemptSchema),
  totalAnsweredCorrect: z.number(),
  totalAnsweredQuestions: z.number(),
  totalQuestions: z.number(),
});
export type CourseQuizProgressEntry = z.infer<typeof courseQuizProgressEntrySchema>;

/** `GET /api/v2/learners/courses/:courseId/quizzes/progress`. */
export const courseQuizProgressResultSchema = z.object({
  courseId: z.string(),
  status: courseProgressStatusSchema,
  progress: z.number(),
  quizzes: z.array(courseQuizProgressEntrySchema),
});
export type CourseQuizProgressResult = z.infer<typeof courseQuizProgressResultSchema>;
