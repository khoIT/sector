import { useQuery } from '@tanstack/react-query';

import { getCourseQuizProgress } from '../endpoints/course-progress';
import { courseQuizProgressKeys } from '../query-keys';
import type { CourseQuizProgressResult } from '../schemas/course-progress';
import { useApiClient } from './api-provider';

/**
 * `GET /api/v2/learners/courses/:courseId/quizzes/progress`. Read-only hook
 * for the quiz page's pre-attempt screen (deciding Start/Continue/Retake);
 * the course-quiz adapter (`quiz/engine/adapters/course.ts`) calls the same
 * endpoint function directly during a running attempt, for the reason
 * `use-question-banks.ts` documents on its own progress hook: the reducer,
 * not react-query, owns a running attempt's state.
 */
export function useCourseQuizProgress(courseId: string, enabled = true) {
  const client = useApiClient();

  return useQuery<CourseQuizProgressResult>({
    queryKey: courseQuizProgressKeys.root(courseId),
    queryFn: ({ signal }) => getCourseQuizProgress(client, courseId, signal),
    enabled: enabled && Boolean(courseId),
  });
}
