/**
 * URLs for the courses surfaces, kept in one file so My Courses, the outline
 * page, the router and the nav entry cannot drift apart — same pattern as
 * `groups-links.ts` and `scan-detail-links.ts`.
 *
 * The three string shapes here — `/learn/courses`, `/learn/courses/:courseId`
 * and `/learn/courses/:courseId/:itemId` — are pinned by
 * `app/legacy-route-map.ts`'s `SECTOR_PATH`: every legacy course URL already
 * redirects to one of these, and a test asserts it. Do not change a segment
 * here without changing it there too.
 */
export const COURSES_PATH = '/learn/courses';

export function coursePathFor(courseId: string): string {
  return `${COURSES_PATH}/${courseId}`;
}

/** Where an outline item opens: the course runner (this phase). */
export function courseItemPathFor(courseId: string, itemId: string): string {
  return `${COURSES_PATH}/${courseId}/${itemId}`;
}

function stripLeadingSlash(path: string): string {
  return path.replace(/^\//, '');
}

/** Route path for My Courses, relative to the app root. */
export const COURSES_INDEX_ROUTE_PATH = stripLeadingSlash(COURSES_PATH);

/** Route path for one course's outline, relative to the app root. */
export const COURSE_OUTLINE_ROUTE_PATH = `${COURSES_INDEX_ROUTE_PATH}/:courseId`;

/** Route path for the course runner: one route for every item kind and
 *  every nesting shape the outline resolves. */
export const COURSE_ITEM_ROUTE_PATH = `${COURSES_INDEX_ROUTE_PATH}/:courseId/:itemId`;

/** The admin/leader read-only view of a learner's course state — a sibling
 *  of `/learn/courses`, not nested under it, so it can never collide with
 *  `COURSE_ITEM_ROUTE_PATH`'s `:courseId/:itemId` segment pair. */
export const COURSE_ADMIN_ROUTE_PATH = 'learn/course-progress/:learnerId/:courseId';

export function courseAdminPathFor(learnerId: string, courseId: string): string {
  return `/learn/course-progress/${learnerId}/${courseId}`;
}
