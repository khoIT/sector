import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteScan } from '../endpoints/scan-delete';
import { SCAN_LIST_VIEWS, mutationKeys, scanKeys, sharedScanKeys } from '../query-keys';
import { useApiClient } from './api-provider';

/**
 * Soft-delete one scan.
 *
 * Invalidates every scan list rather than removing the row from the cache. The
 * lists are server-paginated, so dropping a row locally would leave the page
 * one short and the toolbar's total count wrong until something else refetched.
 * The shared-scan lists go too: a deleted scan should not stay visible to the
 * people it was shared with.
 */
export function useDeleteScanMutation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, Error, { scanId: string }>({
    mutationKey: mutationKeys.deleteScan(),
    mutationFn: ({ scanId }) => deleteScan(client, scanId),
    onSuccess: (_result, { scanId }) => {
      for (const view of SCAN_LIST_VIEWS) {
        void queryClient.invalidateQueries({ queryKey: scanKeys.listRoot(view) });
        // Dropped rather than invalidated: there is nothing to refetch, and a
        // cached detail would otherwise be served on a back-navigation until
        // its refetch 404s.
        queryClient.removeQueries({ queryKey: scanKeys.detail(view, scanId) });
      }
      void queryClient.invalidateQueries({ queryKey: sharedScanKeys.listRoot() });
    },
  });
}
