import type { ApiClient } from '../client';
import {
  dashboardGroupChartsSchema,
  type DashboardGroupCharts,
  type DashboardGroupChartsQuery,
} from '../schemas/dashboard';

/**
 * GET /api/dashboard/charts — one group's course-completion standing.
 *
 * `groupId` is required server-side (`getChartsData` 400s without it) and
 * `courseId` is required in practice: the controller builds
 * `courseProgressChart` from three zero segments and fills them only inside
 * `if (courseId) { … }`, so a group-only request answers `[0,0,0]` however
 * many learners the group has. `role` narrows which members the chart counts
 * (`'all' | 'leaders' | 'learners'`, default `'learners'`).
 *
 * The response's scan array is not parsed — see `dashboardGroupChartsSchema`
 * for why a group's scan counts must come from `scan-progress-by-user`.
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
