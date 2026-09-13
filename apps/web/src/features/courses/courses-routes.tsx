import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

import { COURSE_OUTLINE_ROUTE_PATH, COURSES_INDEX_ROUTE_PATH } from './courses-links';

/**
 * Routes for My Courses and the course outline, spread into `featureRoutes`.
 *
 * No permission gate, deliberately: both API routes scope on the caller's own
 * enrolment (`authUser` only), not on a role permission, so there is nothing
 * for `<RequirePermission>` to check — see CONTRACTS.md §5 for the pattern
 * this departs from and why.
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

export const coursesRoutes: RouteObject[] = [
  { path: COURSES_INDEX_ROUTE_PATH, element: <MyCoursesPage /> },
  { path: COURSE_OUTLINE_ROUTE_PATH, element: <CourseOutlinePage /> },
];
