import type { z } from 'zod';

import type { ApiClient } from '../client';
import {
  createScanResponseSchema,
  fileDetailsStatusResponseSchema,
} from '../schemas/scan-payloads';
import type {
  CreateScanPayload,
  CreateScanResponse,
  FileDetailsStatusPayload,
  UpdateFilePayload,
} from '../schemas/scan-payloads';

/** Scan write endpoints used by the create-scan wizard. */

/**
 * POST /api/scan/create.
 *
 * Stores each `files[].filepath` VERBATIM — no key rebuild, no existence check
 * — which is what allows the wizard to transfer bytes to S3 under a
 * client-minted draft prefix before any scan record exists and still end up
 * with File documents that resolve to real objects.
 *
 * `groupIds` is accepted here and NOWHERE else, so this call has to carry the
 * group routing the user chose.
 */
export async function createScan(
  client: ApiClient,
  payload: CreateScanPayload,
  signal?: AbortSignal,
): Promise<CreateScanResponse> {
  return client.post('/api/scan/create', {
    body: payload,
    schema: createScanResponseSchema,
    signal,
  });
}

/**
 * PUT /api/file/:fileId/update — confirm one uploaded file.
 *
 * Deliberately never sends `filepath`: see updateFilePayloadSchema. Passing
 * `scanId` with `status: 'completed'` increments the scan's fileCount, and the
 * server flips the scan to `submitted` on the last file.
 */
export async function updateScanFileStatus(
  client: ApiClient,
  fileId: string,
  payload: UpdateFilePayload,
  signal?: AbortSignal,
): Promise<void> {
  await client.put(`/api/file/${fileId}/update`, { body: payload, signal });
}

/**
 * PATCH /api/scan/:scanId/file-details/status.
 *
 * Keyed by FILENAME rather than id, so two files with the same name in one
 * scan are ambiguous — the wizard de-duplicates names before upload.
 */
export async function updateFileDetailsStatus(
  client: ApiClient,
  scanId: string,
  payload: FileDetailsStatusPayload,
  signal?: AbortSignal,
): Promise<z.infer<typeof fileDetailsStatusResponseSchema>> {
  return client.patch(`/api/scan/${scanId}/file-details/status`, {
    body: payload,
    schema: fileDetailsStatusResponseSchema,
    signal,
  });
}
