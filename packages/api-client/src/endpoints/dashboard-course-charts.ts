import type { ApiClient } from '../client';
import {
  courseCompletionTimelineSchema,
  courseProgressChartSchema,
  topCourseProgressSchema,
  type CourseCompletionTimeline,
  type CourseCompletionTimelineQuery,
  type CourseProgressChart,
  type TopCourseProgress,
  type TopCourseProgressQuery,
} from '../schemas/dashboard';

/**
 * The "my learning" charts: one caller's own module breakdown for one
 * course, their top courses by progress, and one course's daily completion
 * trend. All three take an optional `userId`/`groupId` so a group leader or
 * administrator can point them at a member instead of themself.
 *
 * What the server actually enforces, since an earlier version of this comment
 * claimed more: `checkUserAccess` (dashboard.controller.ts) returns true as
 * soon as `requestUserId === targetUserId`, and every handler in that file
 * derives `userId = query.userId || req.user.id`. So a request that names
 * ANOTHER user is checked and refused, while a request that names only a
 * `groupId` never reaches the group check at all — a plain subscriber gets a
 * 200 for any group id. Verified against the mirror API. That is an API bug
 * on the findings list, not a guarantee to build on: treat a group id sent
 * from here as unverified by the server, and send only ids the UI itself
 * obtained from a scoped list.
 */

function definedQuery(query: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;
}

/** GET /api/dashboard/course-progress-chart — module completion for one course. */
export async function getDashboardCourseProgress(
  client: ApiClient,
  query: { courseId: string; userId?: string; groupId?: string },
  signal?: AbortSignal,
): Promise<CourseProgressChart> {
  return client.get('/api/dashboard/course-progress-chart', {
    query: definedQuery(query),
    schema: courseProgressChartSchema,
    signal,
  });
}

/** GET /api/dashboard/top-course-progress — ranked by progress, most recent first. */
export async function getDashboardTopCourseProgress(
  client: ApiClient,
  query: TopCourseProgressQuery = {},
  signal?: AbortSignal,
): Promise<TopCourseProgress> {
  return client.get('/api/dashboard/top-course-progress', {
    query: definedQuery({ ...query, limit: query.limit ? String(query.limit) : undefined }),
    schema: topCourseProgressSchema,
    signal,
  });
}

/** GET /api/dashboard/course-completion-timeline — one course's daily trend. */
export async function getDashboardCourseCompletionTimeline(
  client: ApiClient,
  query: CourseCompletionTimelineQuery,
  signal?: AbortSignal,
): Promise<CourseCompletionTimeline> {
  return client.get('/api/dashboard/course-completion-timeline', {
    query: definedQuery(query),
    schema: courseCompletionTimelineSchema,
    signal,
  });
}
