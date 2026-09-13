import type { ApiClient } from '../client';
import {
  scanNoteListSchema,
  scanNoteSchema,
  type ScanNote,
  type ScanNoteList,
} from '../schemas/scan';

/**
 * Scan notes — the conversation thread between the learner and the reviewer.
 *
 * GET returns `{ totalItems, items }` with NO page/limit/totalPages, so it has
 * its own type and must not be handled as Paginated<T>.
 *
 * Guarded by `read:scan:note` / `create:scan:note` / `delete:scan:note`, which
 * are separate from the scan read permissions: a role can open a scan and still
 * 403 on its notes.
 */
export async function getScanNotes(
  client: ApiClient,
  scanId: string,
  keyword?: string,
  signal?: AbortSignal,
): Promise<ScanNoteList> {
  return client.get(`/api/scan/${scanId}/notes`, {
    query: keyword ? { keyword } : undefined,
    schema: scanNoteListSchema,
    signal,
  });
}

/** POST /api/scan/:scanId/notes — answers 201 with the created note. */
export async function addScanNote(
  client: ApiClient,
  scanId: string,
  note: string,
  signal?: AbortSignal,
): Promise<ScanNote> {
  return client.post(`/api/scan/${scanId}/notes`, {
    body: { note },
    schema: scanNoteSchema,
    signal,
  });
}
