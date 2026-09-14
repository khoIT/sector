import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

import {
  COURSE_ADMIN_ROUTE_PATH,
  COURSE_ITEM_ROUTE_PATH,
  COURSE_OUTLINE_ROUTE_PATH,
  COURSES_INDEX_ROUTE_PATH,
} from './courses-links';

/**
 * Routes for My Courses, the course outline, the course runner and the
 * read-only admin view, spread into `featureRoutes`.
 *
 * No permission gate on the learner-facing routes, deliberately: those API
 * routes scope on the caller's own enrolment (`authUser` only), not on a role
 * permission, so there is nothing for `<RequirePermission>` to check — see
 * CONTRACTS.md §5 for the pattern this departs from and why. The admin route
 * gates itself internally (`course-read-only.tsx`, `canAny`), because it
 * needs "admin OR group leader", which `<RequirePermission>`'s all-must-match
 * `required` array cannot express.
 *
 * Lazily loaded, same as the groups surfaces: reached from the "Learn" nav
 * section, not from a list a page depends on at boot.
 */
const MyCoursesPage = lazy(() =>
  import('./my-courses/my-courses-page').then((module) => ({ default: module.MyCoursesPage })),
);
const CourseOutlinePage = lazy(() =>
  import('./outline/course-outline-page').then((module) => ({ default: module.CourseOutlinePage })),
);
const CourseRunnerPage = lazy(() =>
  import('./runner/course-runner-page').then((module) => ({ default: module.CourseRunnerPage })),
);
const CourseReadOnlyAdminPage = lazy(() =>
  import('./admin/course-read-only').then((module) => ({
    default: module.CourseReadOnlyAdminPage,
  })),
);

export const coursesRoutes: RouteObject[] = [
  { path: COURSES_INDEX_ROUTE_PATH, element: <MyCoursesPage /> },
  { path: COURSE_OUTLINE_ROUTE_PATH, element: <CourseOutlinePage /> },
  { path: COURSE_ITEM_ROUTE_PATH, element: <CourseRunnerPage /> },
  { path: COURSE_ADMIN_ROUTE_PATH, element: <CourseReadOnlyAdminPage /> },
];
