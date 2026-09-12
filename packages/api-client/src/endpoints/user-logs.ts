import type { ApiClient } from '../client';
import { createUserLogsResponseSchema, type UserLogEntry } from '../schemas/user-log';

/**
 * POST /api/user-logs — write a batch of activity logs, newest id last.
 *
 * Authenticated but ungated: the route carries `authUser` and no
 * `withPermission`, so every role that can create a scan can record what it
 * did with it.
 */
export async function createUserLogs(
  client: ApiClient,
  logs: readonly UserLogEntry[],
  signal?: AbortSignal,
): Promise<string[]> {
  if (logs.length === 0) return [];

  const created = await client.post('/api/user-logs', {
    body: { logs },
    schema: createUserLogsResponseSchema,
    signal,
  });

  return created.map((log) => log.id);
}
