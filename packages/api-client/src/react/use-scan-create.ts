import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createScan, updateFileDetailsStatus, updateScanFileStatus } from '../endpoints/scan-write';
import { mutationKeys, scanKeys } from '../query-keys';
import type {
  CreateScanPayload,
  FileDetailsStatusPayload,
  UpdateFilePayload,
} from '../schemas/scan-payloads';
import { useApiClient } from './api-provider';

/** Writes performed when the create-scan wizard submits. */

export function useCreateScan() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.createScan(),
    mutationFn: (payload: CreateScanPayload) => createScan(client, payload),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: scanKeys.listRoot('my') });
    },
  });
}

/**
 * Confirm one uploaded file. Invalidates the scan detail off the REQUEST's
 * scanId — the response is a File document and does not carry the scan.
 */
export function useUpdateScanFileStatus() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.updateFileDetailsStatus(),
    mutationFn: (input: { fileId: string; payload: UpdateFilePayload }) =>
      updateScanFileStatus(client, input.fileId, input.payload),
    onSettled: (_data, _error, variables) => {
      if (variables.payload.scanId) {
        void queryClient.invalidateQueries({
          queryKey: scanKeys.detail('my', variables.payload.scanId),
        });
      }
      void queryClient.invalidateQueries({ queryKey: scanKeys.listRoot('my') });
    },
  });
}

export function useUpdateFileDetailsStatus() {
  const client = useApiClient();

  return useMutation({
    mutationKey: mutationKeys.updateFileDetailsStatus(),
    mutationFn: (input: { scanId: string; payload: FileDetailsStatusPayload }) =>
      updateFileDetailsStatus(client, input.scanId, input.payload),
  });
}
