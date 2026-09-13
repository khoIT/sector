import { useMutation, useQueryClient } from '@tanstack/react-query';

import { resetScanUpload } from '../endpoints/scan-reset-upload';
import { mutationKeys, scanKeys } from '../query-keys';
import { useApiClient } from './api-provider';

/**
 * Reset a failed / failed-upload scan back to `pending` so its owner can
 * retry the upload into the same study.
 *
 * Invalidated the same way the rest of the file-upload mutations are (see
 * CONTRACTS.md's invalidation graph: "add/delete files, reset upload ->
 * listRoot('my') + detail('my', id)") — `my` is the only view an owner's own
 * scan is guaranteed to be visible from.
 */
export function useResetScanUpload() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.resetScanUpload(),
    mutationFn: (scanId: string) => resetScanUpload(client, scanId),
    onSettled: (_data, _error, scanId) => {
      void queryClient.invalidateQueries({ queryKey: scanKeys.listRoot('my') });
      void queryClient.invalidateQueries({ queryKey: scanKeys.detail('my', scanId) });
    },
  });
}
