import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getScanReviewCredits,
  purchaseScanReviewCredits,
  requestExpertScanReview,
} from '../endpoints/scan-review-credits';
import { mutationKeys, reviewKeys, scanKeys } from '../query-keys';
import type {
  PurchaseCreditsPayload,
  RequestExpertReviewPayload,
} from '../schemas/scan-review-credits';
import { useApiClient } from './api-provider';

export function useScanReviewCredits(enabled = true) {
  const client = useApiClient();

  return useQuery({
    queryKey: reviewKeys.credits(),
    queryFn: ({ signal }) => getScanReviewCredits(client, signal),
    enabled,
  });
}

/**
 * Spend a credit on an expert review.
 *
 * Invalidates on settle, not on success: the request applies an
 * `expert_scan_review` tag and may debit a credit before a later step fails,
 * so the cached balance and scan lists are stale either way.
 */
export function useRequestExpertScanReview() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.requestExpertScanReview(),
    mutationFn: (payload: RequestExpertReviewPayload) => requestExpertScanReview(client, payload),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.credits() });
      void queryClient.invalidateQueries({ queryKey: scanKeys.listRoot('my') });
    },
  });
}

/** Create a Stripe Checkout session. The caller navigates to `url`. */
export function usePurchaseScanCredits() {
  const client = useApiClient();

  return useMutation({
    mutationKey: mutationKeys.purchaseScanCredits(),
    mutationFn: (payload: PurchaseCreditsPayload) => purchaseScanReviewCredits(client, payload),
  });
}
