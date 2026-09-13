import type { ApiClient } from '../client';
import { scanTagPayloadSchema, type ScanTagPayload } from '../schemas/scan-tags';

/*
 * GET /api/scan/:scanId/tags is deliberately not wrapped. Every surface that
 * reads tags already has them: the list routes and the detail routes both send
 * `tags` on the scan, and `scanSchema` parses it. A second way to ask the same
 * question is a second thing to keep in sync.
 */

/**
 * POST /api/scan/:scanId/tags. Requires `edit:scan`.
 *
 * Adding `incomplete` triggers the server's OWN email to the learner
 * (`scan-tag.controller.ts`, gated on their notification settings) — never
 * send a second one from here.
 *
 * The server writes with `$push`, not `$addToSet`: it does not de-duplicate
 * and does not enforce the completeness tags being mutually exclusive. Callers
 * needing that — the mark-complete/incomplete actions — must add and remove
 * as a pair; see `completionTagMutation` in the scan-list feature.
 */
export async function addScanTag(
  client: ApiClient,
  scanId: string,
  tag: string,
  signal?: AbortSignal,
): Promise<void> {
  const body: ScanTagPayload = scanTagPayloadSchema.parse({ tag });
  await client.post(`/api/scan/${scanId}/tags`, { body, signal });
}

/** DELETE /api/scan/:scanId/tags. Requires `edit:scan`. Sends the tag as a body, not a query param. */
export async function removeScanTag(
  client: ApiClient,
  scanId: string,
  tag: string,
  signal?: AbortSignal,
): Promise<void> {
  const body: ScanTagPayload = scanTagPayloadSchema.parse({ tag });
  await client.del(`/api/scan/${scanId}/tags`, { body, signal });
}
