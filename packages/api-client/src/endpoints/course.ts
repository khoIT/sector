import type { ApiClient } from '../client';
import { courseOutlineSchema, type CourseOutline } from '../schemas/course-outline';
import { learnerCoursesPageSchema, type LearnerCoursesPage } from '../schemas/course';

/**
 * My Courses + the course outline (`GET /api/v2/learners/*`).
 *
 * Both routes are scoped to the caller by `authUser`: there is no permission
 * to gate on, only an enrolment to have. `useCourses`/`useCourseOutline` in
 * `../react` are the intended call sites; these are exported for anywhere
 * else that needs the plain request (a prefetch, a test).
 */

export type CourseListStatusFilter =
  'not_started' | 'in_progress' | 'completed' | 'expired' | 'active' | 'paused' | 'dropped';

export type CoursesListQuery = {
  /** Matched against course title/content (and the group name, for a group
   *  assignment) server-side — see `learnersService.getLearnerCourses`. */
  keyword?: string;
  status?: CourseListStatusFilter;
  page?: number;
  limit?: number;
  /** Defaults server-side to `enrolledAt:desc`. */
  sortBy?: string;
};

function coursesListParams(query: CoursesListQuery) {
  return {
    page: String(query.page ?? 1),
    limit: String(query.limit ?? 20),
    ...(query.keyword?.trim() ? { keyword: query.keyword.trim() } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.sortBy ? { sortBy: query.sortBy } : {}),
  };
}

/**
 * GET /api/v2/learners/courses — the learner's own enrolments, paginated and
 * filtered server-side. Do not fetch this unbounded and filter in the
 * browser: that was the legacy dashboard's bug, and it is exactly what
 * silently hid enrolment 101+ from a learner with more than 100 courses.
 */
export async function getLearnerCourses(
  client: ApiClient,
  query: CoursesListQuery = {},
  signal?: AbortSignal,
): Promise<LearnerCoursesPage> {
  return client.get('/api/v2/learners/courses', {
    query: coursesListParams(query),
    schema: learnerCoursesPageSchema,
    signal,
  });
}

/**
 * GET /api/v2/learners/courses/:courseId/outline — the resolved, ordered
 * item list this phase exists to serve. 404s with "Your account or group is
 * not enrolled to this course" for a courseId the caller cannot open;
 * `ApiError.isNotFound` on the result is how the caller tells that apart
 * from a course that does not exist at all.
 */
export async function getCourseOutline(
  client: ApiClient,
  courseId: string,
  signal?: AbortSignal,
): Promise<CourseOutline> {
  return client.get(`/api/v2/learners/courses/${courseId}/outline`, {
    schema: courseOutlineSchema,
    signal,
  });
}
