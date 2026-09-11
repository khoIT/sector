import { useMutation, useQueryClient } from '@tanstack/react-query';

import { addScanReview } from '../endpoints/scan-review-submit';
import { mutationKeys, noteKeys, reviewKeys, scanKeys, SCAN_LIST_VIEWS } from '../query-keys';
import type { AddScanReviewPayload, ScanReviewResult } from '../schemas/scan-review-submit';
import { useApiClient } from './api-provider';

export type AddScanReviewVariables = {
  scanId: string;
  payload: AddScanReviewPayload;
};

/**
 * Submit a review.
 *
 * INVALIDATION — the legacy bug this fixes. The old hook invalidated exactly
 * four keys: the pending list, the pending detail, the expert list and the
 * expert detail. It then navigated the reviewer to the REVIEWED scan, whose
 * cache it had just left untouched, so the destination rendered the
 * pre-review copy of the scan — no review block, status still "Submitted" —
 * until a manual refresh.
 *
 * A review does not belong to one view: it takes the scan out of the pending
 * and expert queues, puts it into the reviewed and expert-reviewed queues, and
 * changes the row the owner sees on their own list. So every list root and
 * every detail key for this scan is invalidated. Five views is a handful of
 * cheap cache entries; a stale destination is a bug report.
 *
 * Notes are invalidated because a non-empty `payload.note` creates one
 * server-side, and credits because every scan-review mutation moves a balance.
 *
 * `onSettled`, not `onSuccess`: a submit that fails after the write (an email
 * timeout, an aborted response) still leaves the server changed, which is why
 * the legacy scan flows settled too.
 */
export function useAddScanReviewMutation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ScanReviewResult, Error, AddScanReviewVariables>({
    mutationKey: mutationKeys.addScanReview(),
    mutationFn: ({ scanId, payload }) => addScanReview(client, scanId, payload),
    onSettled: (result, _error, variables) => {
      // Prefer the id the server echoed (normalised to a string by the schema);
      // fall back to the request when the call failed before answering.
      const scanId = result?.scan ?? variables.scanId;

      for (const view of SCAN_LIST_VIEWS) {
        void queryClient.invalidateQueries({ queryKey: scanKeys.listRoot(view) });
        void queryClient.invalidateQueries({ queryKey: scanKeys.detail(view, scanId) });
      }

      void queryClient.invalidateQueries({ queryKey: noteKeys.list(scanId) });
      void queryClient.invalidateQueries({ queryKey: reviewKeys.credits() });
    },
  });
}
