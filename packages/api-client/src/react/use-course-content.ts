import { useQuery } from '@tanstack/react-query';

import {
  getCourseLessonDetail,
  getCourseQuizDetail,
  getCourseTopicDetail,
} from '../endpoints/course-content';
import { courseContentKeys } from '../query-keys';
import type { CourseContentBody, CourseQuizDetail } from '../schemas/course-content';
import { useApiClient } from './api-provider';

/** A lesson's own body (`GET /api/lms/courses/:courseId/lessons/:lessonId`). */
export function useCourseLessonDetail(courseId: string, lessonId: string, enabled = true) {
  const client = useApiClient();

  return useQuery<CourseContentBody>({
    queryKey: courseContentKeys.lesson(courseId, lessonId),
    queryFn: ({ signal }) => getCourseLessonDetail(client, courseId, lessonId, signal),
    enabled: enabled && Boolean(courseId) && Boolean(lessonId),
  });
}

/** A topic's own body (`GET /api/lms/topics/:topicId`), which may embed a
 *  Vimeo player iframe. */
export function useCourseTopicDetail(courseId: string, topicId: string, enabled = true) {
  const client = useApiClient();

  return useQuery<CourseContentBody>({
    queryKey: courseContentKeys.topic(courseId, topicId),
    queryFn: ({ signal }) => getCourseTopicDetail(client, courseId, topicId, signal),
    enabled: enabled && Boolean(courseId) && Boolean(topicId),
  });
}

/** A quiz's questions (`GET /api/lms/quizzes/:quizId`). Not called for a
 *  `blockedReason` item — the outline already knows it has no questions. */
export function useCourseQuizDetail(courseId: string, quizId: string, enabled = true) {
  const client = useApiClient();

  return useQuery<CourseQuizDetail>({
    queryKey: courseContentKeys.quiz(courseId, quizId),
    queryFn: ({ signal }) => getCourseQuizDetail(client, courseId, quizId, signal),
    enabled: enabled && Boolean(courseId) && Boolean(quizId),
  });
}
