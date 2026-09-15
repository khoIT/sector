import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

import {
  COURSE_ABOUT_ROUTE_PATH,
  COURSE_ADMIN_ROUTE_PATH,
  COURSE_ITEM_CHILD_ROUTE_PATH,
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
const CourseShell = lazy(() =>
  import('./shell/course-shell').then((module) => ({ default: module.CourseShell })),
);
const CourseItemRoute = lazy(() =>
  import('./shell/course-item-route').then((module) => ({ default: module.CourseItemRoute })),
);
const CourseLandingPage = lazy(() =>
  import('./landing/course-landing-page').then((module) => ({
    default: module.CourseLandingPage,
  })),
);
const CourseReadOnlyAdminPage = lazy(() =>
  import('./admin/course-read-only').then((module) => ({
    default: module.CourseReadOnlyAdminPage,
  })),
);

export const coursesRoutes: RouteObject[] = [
  { path: COURSES_INDEX_ROUTE_PATH, element: <MyCoursesPage /> },
  // One layout route owns the outline query and the course chrome; the
  // outline page and the item views are its children, so moving between two
  // items never unmounts the contents pane. `COURSE_ITEM_ROUTE_PATH` is still
  // the URL this resolves to — the child path is the same last segment.
  {
    path: COURSE_OUTLINE_ROUTE_PATH,
    element: <CourseShell />,
    children: [
      { index: true, element: <CourseOutlinePage /> },
      { path: COURSE_ITEM_CHILD_ROUTE_PATH, element: <CourseItemRoute /> },
    ],
  },
  // Declared before the shell purely for readability; React Router ranks by
  // specificity, and `about` being static is what makes it win over
  // `:itemId` regardless of order.
  { path: COURSE_ABOUT_ROUTE_PATH, element: <CourseLandingPage /> },
  { path: COURSE_ADMIN_ROUTE_PATH, element: <CourseReadOnlyAdminPage /> },
];
