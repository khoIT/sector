import type { ApiClient } from '../client';
import {
  learnerCourseAdminResultSchema,
  type LearnerCourseAdminResult,
} from '../schemas/learner-course-admin';

/** `GET /dashboard/learner-course-detail?userId=&courseId=` — an admin or
 *  group leader's read-only view of one learner's course. 403s server-side
 *  for anyone else, and for a leader viewing a learner outside their groups. */
export async function getLearnerCourseAdminDetail(
  client: ApiClient,
  learnerId: string,
  courseId: string,
  signal?: AbortSignal,
): Promise<LearnerCourseAdminResult> {
  return client.get('/api/dashboard/learner-course-detail', {
    query: { userId: learnerId, courseId },
    schema: learnerCourseAdminResultSchema,
    signal,
  });
}
