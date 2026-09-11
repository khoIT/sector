import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addScanNote, getScanNotes } from '../endpoints/scan-note';
import { mutationKeys, noteKeys, scanKeys, SCAN_LIST_VIEWS } from '../query-keys';
import type { ScanNote, ScanNoteList } from '../schemas/scan';
import { useApiClient } from './api-provider';

/**
 * The note thread for one scan.
 *
 * `enabled` exists because the notes routes carry their own permission
 * (`read:scan:note`): a surface that can render a scan but not its notes must
 * be able to skip the request rather than eat a 403.
 */
export function useScanNotes(scanId: string | undefined, enabled = true) {
  const client = useApiClient();

  return useQuery<ScanNoteList>({
    queryKey: noteKeys.list(scanId ?? ''),
    queryFn: ({ signal }) => getScanNotes(client, scanId as string, undefined, signal),
    enabled: enabled && Boolean(scanId),
  });
}

export type AddScanNoteVariables = {
  scanId: string;
  note: string;
};

/**
 * Add a note.
 *
 * The scan carries an embedded `notes[]` copy alongside the standalone note
 * collection, so the scan detail is stale after this too — invalidated for
 * every view because the same scan is reachable through all of them.
 */
export function useAddScanNoteMutation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ScanNote, Error, AddScanNoteVariables>({
    mutationKey: mutationKeys.addScanNote(),
    mutationFn: ({ scanId, note }) => addScanNote(client, scanId, note),
    onSettled: (_result, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: noteKeys.list(variables.scanId) });
      for (const view of SCAN_LIST_VIEWS) {
        void queryClient.invalidateQueries({ queryKey: scanKeys.detail(view, variables.scanId) });
      }
      void queryClient.invalidateQueries({ queryKey: scanKeys.listRoot('my') });
    },
  });
}
