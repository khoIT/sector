import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createScanShare,
  deleteScanShare,
  getSharedScanDetail,
  getSharesForScan,
} from '../endpoints/scan-share';
import { mutationKeys, sharedScanKeys } from '../query-keys';
import type { SharedScanDetail } from '../schemas/shared-scan-detail';
import type {
  CreateScanSharePayload,
  CreateScanShareResult,
  ScanShare,
} from '../schemas/shared-scan';
import { useApiClient } from './api-provider';

/**
 * Every share the signed-in user has granted for one scan.
 *
 * Keyed under the `get-shared-scans` list root so that creating or revoking a
 * share invalidates both this and the recipient-facing "shared with me" list
 * with one prefix.
 */
export function useSharesForScan(
  params: { scanId: string | undefined; sharedBy: string | undefined },
  enabled = true,
) {
  const client = useApiClient();

  return useQuery<ScanShare[]>({
    queryKey: sharedScanKeys.list({
      scanId: params.scanId ?? '',
      sharedBy: params.sharedBy ?? '',
    }),
    queryFn: ({ signal }) =>
      getSharesForScan(
        client,
        { scanId: params.scanId as string, sharedBy: params.sharedBy as string },
        signal,
      ),
    enabled: enabled && Boolean(params.scanId) && Boolean(params.sharedBy),
  });
}

/**
 * One share, from the RECIPIENT's side, with the scan embedded.
 *
 * Fetching it marks the share `opened` server-side, so the shared-with-me list
 * is invalidated on settle rather than left to go stale — the unopened badge is
 * the whole point of the status.
 */
export function useSharedScanDetail(shareId: string | undefined, enabled = true) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useQuery<SharedScanDetail>({
    queryKey: sharedScanKeys.detail(shareId ?? ''),
    queryFn: async ({ signal }) => {
      const detail = await getSharedScanDetail(client, shareId as string, signal);
      void queryClient.invalidateQueries({ queryKey: sharedScanKeys.listRoot() });
      return detail;
    },
    enabled: enabled && Boolean(shareId),
  });
}

export function useCreateScanShareMutation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<CreateScanShareResult, Error, CreateScanSharePayload>({
    mutationKey: mutationKeys.createSharedScan(),
    mutationFn: (payload) => createScanShare(client, payload),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: sharedScanKeys.listRoot() });
    },
  });
}

export function useDeleteScanShareMutation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, Error, { shareId: string }>({
    mutationKey: mutationKeys.deleteSharedScan(),
    mutationFn: ({ shareId }) => deleteScanShare(client, shareId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: sharedScanKeys.listRoot() });
    },
  });
}
