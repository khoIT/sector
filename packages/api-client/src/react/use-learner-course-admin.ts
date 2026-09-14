import { useQuery } from '@tanstack/react-query';

import { getLearnerCourseAdminDetail } from '../endpoints/learner-course-admin';
import { learnerCourseAdminKeys } from '../query-keys';
import type { LearnerCourseAdminResult } from '../schemas/learner-course-admin';
import { useApiClient } from './api-provider';

/** The read-only admin/leader view of one learner's course. */
export function useLearnerCourseAdminDetail(learnerId: string, courseId: string, enabled = true) {
  const client = useApiClient();

  return useQuery<LearnerCourseAdminResult>({
    queryKey: learnerCourseAdminKeys.detail(learnerId, courseId),
    queryFn: ({ signal }) => getLearnerCourseAdminDetail(client, learnerId, courseId, signal),
    enabled: enabled && Boolean(learnerId) && Boolean(courseId),
  });
}
