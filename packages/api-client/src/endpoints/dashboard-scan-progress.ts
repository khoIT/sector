import type { ApiClient } from '../client';
import {
  scanProgressByUserSchema,
  type ScanProgressByUser,
  type ScanProgressByUserQuery,
} from '../schemas/dashboard';

/**
 * GET /api/dashboard/scan-progress-by-user — scan counts by status for one
 * user, or every learner in a group when `groupId` is given. Its own file
 * because it is the one dashboard chart whose status field was already a
 * code on the wire (`statusKey`), not a label — see the schema's doc comment.
 */
export async function getDashboardScanProgress(
  client: ApiClient,
  query: ScanProgressByUserQuery = {},
  signal?: AbortSignal,
): Promise<ScanProgressByUser> {
  return client.get('/api/dashboard/scan-progress-by-user', {
    query: {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.startDate ? { startDate: query.startDate } : {}),
      ...(query.endDate ? { endDate: query.endDate } : {}),
    },
    schema: scanProgressByUserSchema,
    signal,
  });
}
