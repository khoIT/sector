import type { ApiClient } from '../client';
import {
  courseQuizProgressResultSchema,
  retakeCourseQuizResultSchema,
  trackCourseQuizProgressResultSchema,
  trackItemPositionResultSchema,
  type CourseQuizProgressResult,
  type RetakeCourseQuizResult,
  type TrackCourseProgressPayload,
  type TrackCourseQuizProgressPayload,
  type TrackCourseQuizProgressResult,
  type TrackItemPositionPayload,
  type TrackItemPositionResult,
} from '../schemas/course-progress';

const BASE_PATH = (courseId: string) => `/api/v2/learners/courses/${courseId}`;

/**
 * `POST /api/v2/learners/courses/:courseId/track` — the course/lesson/topic/
 * quiz "viewed" ping the outline's status is derived from. No schema: see
 * `trackCourseProgressPayloadSchema`'s doc comment in `schemas/course-progress.ts`
 * for why the response is neither modelled nor read.
 */
export async function trackCourseProgress(
  client: ApiClient,
  courseId: string,
  payload: TrackCourseProgressPayload,
  signal?: AbortSignal,
): Promise<void> {
  await client.post(`${BASE_PATH(courseId)}/track`, { body: payload, signal });
}

/**
 * `POST /api/v2/learners/courses/:courseId/items/:itemId/position` — where the
 * learner's playhead is, written every twelve seconds or so of playback.
 *
 * `keepalive` because the write that matters most is the last one, issued from
 * `pagehide` as the tab closes; without it the browser cancels the request
 * along with the document. The bodies here are a few dozen bytes, far inside
 * the 64 KB keepalive cap.
 *
 * Answers `204` with no body when the learner has no progress row for the item
 * yet — the caller gets `null` and should stop sending until `/track` has run.
 */
export async function trackItemPosition(
  client: ApiClient,
  courseId: string,
  itemId: string,
  payload: TrackItemPositionPayload,
  options?: { signal?: AbortSignal; keepalive?: boolean },
): Promise<TrackItemPositionResult | null> {
  const result = await client.post<TrackItemPositionResult | null>(
    `${BASE_PATH(courseId)}/items/${itemId}/position`,
    {
      body: payload,
      schema: trackItemPositionResultSchema.nullable(),
      signal: options?.signal,
      keepalive: options?.keepalive,
    },
  );
  return result;
}

/** `POST /api/v2/learners/courses/:courseId/quizzes/:quizId/track` — one
 *  question's answer, graded immediately. */
export async function trackCourseQuizProgress(
  client: ApiClient,
  courseId: string,
  quizId: string,
  payload: TrackCourseQuizProgressPayload,
  signal?: AbortSignal,
): Promise<TrackCourseQuizProgressResult> {
  return client.post(`${BASE_PATH(courseId)}/quizzes/${quizId}/track`, {
    body: payload,
    schema: trackCourseQuizProgressResultSchema,
    signal,
  });
}

/** `GET /api/v2/learners/courses/:courseId/quizzes/progress` — every quiz in
 *  the course, with the caller's own attempts. */
export async function getCourseQuizProgress(
  client: ApiClient,
  courseId: string,
  signal?: AbortSignal,
): Promise<CourseQuizProgressResult> {
  return client.get(`${BASE_PATH(courseId)}/quizzes/progress`, {
    schema: courseQuizProgressResultSchema,
    signal,
  });
}

/** `POST /api/v2/learners/courses/:courseId/quizzes/:quizId/retake` — opens a
 *  fresh attempt and flips the item back to `in_progress` immediately, ahead
 *  of the first new answer. */
export async function retakeCourseQuiz(
  client: ApiClient,
  courseId: string,
  quizId: string,
  signal?: AbortSignal,
): Promise<RetakeCourseQuizResult> {
  return client.post(`${BASE_PATH(courseId)}/quizzes/${quizId}/retake`, {
    schema: retakeCourseQuizResultSchema,
    signal,
  });
}
