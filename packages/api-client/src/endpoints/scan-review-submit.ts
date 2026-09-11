import type { ApiClient } from '../client';
import {
  scanReviewResultSchema,
  type AddScanReviewPayload,
  type ScanReviewResult,
} from '../schemas/scan-review-submit';

/**
 * POST /api/scan/:scanId/review
 *
 * Creates the review, flips the scan to `reviewed`, stamps `reviewedAt`, writes
 * an audit entry onto `scanLogs` and emails the scan owner. NOT idempotent: a
 * second call on an already-reviewed scan is rejected with 400 'Scan review
 * already exists' unless `isExpertScan` is true, which is how an expert
 * re-review of a group-reviewed scan is allowed through.
 *
 * A non-empty `note` additionally creates a scan note, so the note list for the
 * scan is stale after a successful submit.
 */
export async function addScanReview(
  client: ApiClient,
  scanId: string,
  payload: AddScanReviewPayload,
  signal?: AbortSignal,
): Promise<ScanReviewResult> {
  return client.post(`/api/scan/${scanId}/review`, {
    body: payload,
    schema: scanReviewResultSchema,
    signal,
  });
}
