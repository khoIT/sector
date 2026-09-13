import { useMutation, useQueryClient } from '@tanstack/react-query';

import { addScanTag, removeScanTag } from '../endpoints/scan-tags';
import { mutationKeys, scanKeys, type ScanListView } from '../query-keys';
import { useApiClient } from './api-provider';

/**
 * Invalidate everywhere a tag change can be seen: every list (the tag filter
 * lives on `my` and every queue/reviewed view) and every detail view of this
 * one scan, matching CONTRACTS.md's "add/remove tag -> the three detail keys".
 */
function useInvalidateScanTags() {
  const queryClient = useQueryClient();

  return (scanId: string) => {
    for (const root of scanKeys.allListRoots()) {
      void queryClient.invalidateQueries({ queryKey: root });
    }
    for (const view of [
      'my',
      'pending',
      'reviewed',
      'expert',
      'expert-reviewed',
    ] as ScanListView[]) {
      void queryClient.invalidateQueries({ queryKey: scanKeys.detail(view, scanId) });
    }
  };
}

export function useAddScanTag() {
  const client = useApiClient();
  const invalidate = useInvalidateScanTags();

  return useMutation({
    mutationKey: mutationKeys.addScanTag(),
    mutationFn: ({ scanId, tag }: { scanId: string; tag: string }) =>
      addScanTag(client, scanId, tag),
    onSettled: (_data, _error, variables) => invalidate(variables.scanId),
  });
}

export function useRemoveScanTag() {
  const client = useApiClient();
  const invalidate = useInvalidateScanTags();

  return useMutation({
    mutationKey: mutationKeys.removeScanTag(),
    mutationFn: ({ scanId, tag }: { scanId: string; tag: string }) =>
      removeScanTag(client, scanId, tag),
    onSettled: (_data, _error, variables) => invalidate(variables.scanId),
  });
}
