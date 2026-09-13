import type { z } from 'zod';

import type { ApiClient } from '../client';
import {
  createScanResponseSchema,
  fileDetailsStatusResponseSchema,
  scanFilesMutationResponseSchema,
} from '../schemas/scan-payloads';
import type {
  CreateScanPayload,
  CreateScanResponse,
  FileDetailsStatusPayload,
  ScanFilePayload,
  ScanFilesMutationResponse,
  UpdateFilePayload,
  UpdateScanPayload,
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
 * POST /api/scan/:scanId/add-files — register files on a scan that exists.
 *
 * The only way to attach media to a study after `create`. The server rebuilds
 * every `filepath` as `storage/{userId}/scan/{scanId}/{sanitized trailing
 * segment}`, so the bytes must already be under that exact prefix: presign
 * with the scan id, not a draft id.
 *
 * Register as `pending`, not `completed`. Both end up attached, but only a
 * record that is still pending when `updateScanFileStatus` confirms it
 * increments `fileCount` — `updateFileById` guards the increment on
 * `file.status !== completed`. Registering as completed attaches the file and
 * leaves `fileCount` behind forever, which is what makes a recovered scan
 * read as permanently short of its own files.
 *
 * Also `$inc`s `fileTotal` by the number of files added, which is why the
 * response's `fileTotal` is read back rather than assumed.
 */
export async function addScanFiles(
  client: ApiClient,
  scanId: string,
  files: ScanFilePayload[],
  signal?: AbortSignal,
): Promise<ScanFilesMutationResponse> {
  return client.post(`/api/scan/${scanId}/add-files`, {
    body: { files },
    schema: scanFilesMutationResponseSchema,
    signal,
  });
}

/**
 * DELETE /api/scan/:scanId/files — unlink and hard-delete File records.
 *
 * Deletes the File DOCUMENTS and decrements `fileTotal`; it does not touch S3.
 * Used for exactly one thing here: dropping the records of an attempt whose
 * bytes never landed, so a recovered scan is not left counting them. Never
 * call it for a record whose object exists — that is a file the learner still
 * has.
 */
export async function deleteScanFiles(
  client: ApiClient,
  scanId: string,
  fileIds: string[],
  signal?: AbortSignal,
): Promise<ScanFilesMutationResponse> {
  return client.del(`/api/scan/${scanId}/files`, {
    body: { fileIds },
    schema: scanFilesMutationResponseSchema,
    signal,
  });
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

/**
 * PUT /api/scan/:scanId/update — the notification route.
 *
 * Create does not notify anybody: its own notification is guarded on
 * `scanLogs`, which cannot exist before the scan does. So a study is
 * announced here, after its files are confirmed, or not at all.
 */
export async function updateScan(
  client: ApiClient,
  scanId: string,
  payload: UpdateScanPayload,
  signal?: AbortSignal,
): Promise<void> {
  await client.put(`/api/scan/${scanId}/update`, { body: payload, signal });
}
