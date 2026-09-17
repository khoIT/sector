import { Navigate, useParams } from 'react-router-dom';

import { coursePathFor } from './courses-links';

/**
 * `/learn/courses/:courseId/about` → the course page.
 *
 * The description used to live on a page of its own, on the premise that
 * almost no course had one. It leads the course page now, so this URL only
 * forwards — but it stays declared, because learners have it in their history
 * and a 404 on a URL that worked is a regression, not a cleanup.
 *
 * The target is built from the param rather than navigated to as `..`:
 * relative navigation in React Router climbs a ROUTE, and this route's path
 * carries all four segments, so `..` would land on `/`.
 */
export function CourseAboutRedirect() {
  const { courseId = '' } = useParams<{ courseId: string }>();

  return <Navigate to={coursePathFor(courseId)} replace />;
}
