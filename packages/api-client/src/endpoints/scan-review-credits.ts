import type { ApiClient } from '../client';
import {
  purchaseCreditsResponseSchema,
  scanReviewCreditsSchema,
  type PurchaseCreditsPayload,
  type PurchaseCreditsResponse,
  type RequestExpertReviewPayload,
  type ScanReviewCredits,
} from '../schemas/scan-review-credits';

/** GET /api/scan-review/user-credits — the user's balance and each group's. */
export async function getScanReviewCredits(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<ScanReviewCredits> {
  return client.get('/api/scan-review/user-credits', {
    schema: scanReviewCreditsSchema,
    signal,
  });
}

/**
 * POST /api/scan-review/request-expert — spend one credit on an expert review.
 *
 * Returns no data. It 400s when the chosen account has no pending reviews
 * left, so the caller must surface `error.message` rather than a generic
 * failure: "No group has pending scan reviews available" is the message a user
 * needs in order to buy credits.
 */
export async function requestExpertScanReview(
  client: ApiClient,
  payload: RequestExpertReviewPayload,
  signal?: AbortSignal,
): Promise<void> {
  await client.post('/api/scan-review/request-expert', { body: payload, signal });
}

/**
 * POST /api/scan-review/credits/purchase — create a Stripe Checkout session.
 * Both accountType and accountId are required server-side.
 */
export async function purchaseScanReviewCredits(
  client: ApiClient,
  payload: PurchaseCreditsPayload,
  signal?: AbortSignal,
): Promise<PurchaseCreditsResponse> {
  return client.post('/api/scan-review/credits/purchase', {
    body: payload,
    schema: purchaseCreditsResponseSchema,
    signal,
  });
}
