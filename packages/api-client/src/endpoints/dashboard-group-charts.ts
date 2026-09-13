import type { ApiClient } from '../client';
import {
  dashboardGroupChartsSchema,
  type DashboardGroupCharts,
  type DashboardGroupChartsQuery,
} from '../schemas/dashboard';

/**
 * GET /api/dashboard/charts — one group's course-completion and scan-status
 * snapshot, the group-leader/reviewer/administrator home's primary chart.
 *
 * `groupId` is required server-side (`getChartsData` 400s without it); `role`
 * narrows which members the course chart counts (`'all' | 'leaders' |
 * 'learners'`, default `'learners'`).
 */
export async function getDashboardGroupCharts(
  client: ApiClient,
  query: DashboardGroupChartsQuery,
  signal?: AbortSignal,
): Promise<DashboardGroupCharts> {
  return client.get('/api/dashboard/charts', {
    query: {
      groupId: query.groupId,
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.role ? { role: query.role } : {}),
    },
    schema: dashboardGroupChartsSchema,
    signal,
  });
}
