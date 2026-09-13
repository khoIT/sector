import type { ApiClient } from '../client';

/**
 * PUT /api/scan/:scanId/reset-upload.
 *
 * Server preconditions, read off `scan-reset.controller.ts`: only a scan
 * whose status is `failed` or `failed_upload` is accepted — anything else
 * 400s with "Cannot reset scan with status '...'". On success the server
 * resets `fileCount` to 0 and the status to `pending`, and appends one
 * activity-log entry; it does NOT clear the scan's existing File records or
 * its `fileTotal`, which is what lets a retry re-confirm the same files by
 * name once they are re-uploaded.
 *
 * The response body is the updated scan as the raw Mongoose document (no
 * presigned media URLs, different field shapes from every read route), which
 * nothing here has a use for — the caller re-fetches through the ordinary
 * `my` detail route instead, so no schema is declared for it.
 */
export async function resetScanUpload(
  client: ApiClient,
  scanId: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.put(`/api/scan/${scanId}/reset-upload`, { signal });
}
