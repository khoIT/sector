import type { ApiClient } from '../client';

/**
 * DELETE /api/scan/:scanId/delete — a SOFT delete.
 *
 * The server sets `deletedAt` and the scan leaves every list; the record and
 * its S3 objects survive. There is no undelete route, so nothing in this app
 * should describe it as recoverable.
 *
 * Two things about its authorisation are worth knowing at the call site,
 * because they are the reason the caller gates on ownership:
 *
 *   - the route requires `delete:scan`, which EVERY role in the database holds
 *   - the handler loads the scan, 404s if missing, and soft-deletes it. It
 *     never compares the scan's owner to the caller.
 *
 * So the server will happily delete another learner's scan for anyone who can
 * see its id. Callers must not offer the action on a scan the signed-in user
 * does not own.
 *
 * The response envelope carries the deleted scan. Nothing needs it, so this
 * returns void rather than inventing a schema for a body no caller reads.
 */
export async function deleteScan(
  client: ApiClient,
  scanId: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.del(`/api/scan/${scanId}/delete`, { signal });
}
