import type { ApiClient } from '../client';
import {
  courseContentBodySchema,
  courseQuizDetailSchema,
  type CourseContentBody,
  type CourseQuizDetail,
} from '../schemas/course-content';

/** `GET /api/lms/courses/:courseId/lessons/:lessonId` — a lesson's own body. */
export async function getCourseLessonDetail(
  client: ApiClient,
  courseId: string,
  lessonId: string,
  signal?: AbortSignal,
): Promise<CourseContentBody> {
  return client.get(`/api/lms/courses/${courseId}/lessons/${lessonId}`, {
    schema: courseContentBodySchema,
    signal,
  });
}

/** `GET /api/lms/topics/:topicId?courseId=` — a topic's own body, which may
 *  embed a Vimeo player iframe (see `runner/use-vimeo-watch-tracking.ts`). */
export async function getCourseTopicDetail(
  client: ApiClient,
  courseId: string,
  topicId: string,
  signal?: AbortSignal,
): Promise<CourseContentBody> {
  return client.get(`/api/lms/topics/${topicId}`, {
    query: { courseId },
    schema: courseContentBodySchema,
    signal,
  });
}

/** `GET /api/lms/quizzes/:quizId?courseId=` — the quiz's questions, mapped
 *  onto the Phase 5 engine's `QuizQuestion` by `to-course-quiz-questions.ts`. */
export async function getCourseQuizDetail(
  client: ApiClient,
  courseId: string,
  quizId: string,
  signal?: AbortSignal,
): Promise<CourseQuizDetail> {
  return client.get(`/api/lms/quizzes/${quizId}`, {
    query: { courseId },
    schema: courseQuizDetailSchema,
    signal,
  });
}
