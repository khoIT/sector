import { z } from 'zod';

import { userBasicSchema } from './common';
import {
  embeddedScanNoteSchema,
  fileDetailSchema,
  scanFindingSchema,
  scanFormFieldPayloadSchema,
  scanFormResponseSchema,
  scanStatusSchema,
  scanTypeRefSchema,
} from './scan';

/**
 * Write payloads for the scan routes, and the response shapes those writes
 * return — which are NOT the same shape as a read.
 *
 * The important one: POST /api/scan/create answers with a scan whose `files[]`
 * are raw File documents (no presigned `url`, `urlThumbnail`, `url360`, ...)
 * and which carries no `groups` key at all. Parsing that response with
 * `scanSchema` fails on `mediaFileSchema`, so the create response has its own
 * schema. Verified against a live create on gusi_dev.
 */

/** One entry of the `files[]` manifest sent with create / add-files. */
export const scanFilePayloadSchema = z.object({
  batchId: z.string(),
  filename: z.string(),
  filesize: z.number(),
  filetype: z.string(),
  /**
   * The S3 key the bytes actually landed under.
   *
   * POST /api/scan/create stores this VERBATIM. POST /api/scan/:id/add-files
   * does NOT — it rebuilds the key as
   * `storage/{userId}/scan/{scanId}/{sanitized trailing segment}`. So a file
   * uploaded under a draft prefix, before its scan existed, can only be
   * registered through `create`; a file uploaded once the scan id is known is
   * already under that exact prefix, and `add-files` rebuilds the same key.
   * The wizard presigns with the scan id as soon as it has one for this
   * reason — see `transfer` in use-create-scan-draft.ts.
   */
  filepath: z.string(),
  originalFilename: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
});

export type ScanFilePayload = z.infer<typeof scanFilePayloadSchema>;

export const createScanPayloadSchema = z.object({
  scanTypeId: z.string(),
  /** Required by the server; 0 is rejected with 400 'File total cannot be 0'. */
  fileTotal: z.number().int().positive(),
  findings: z.array(z.object({ key: z.string(), value: z.string().optional() })).optional(),
  form: z.array(scanFormFieldPayloadSchema).optional(),
  note: z.string().optional(),
  scanIdentifier: z.string().nullish(),
  externalPatientId: z.string().max(100).nullish(),
  /**
   * Group routing. SETTABLE ONLY HERE — there is no route that adds a group to
   * an existing scan (PUT /api/scan/:id/update has no groupIds field, and the
   * only other writer is the expert-review request, which spends a credit).
   */
  groupIds: z.array(z.string()).optional(),
  notifyUser: z.boolean().optional(),
  files: z.array(scanFilePayloadSchema).optional(),
  fileDetails: z.array(scanFilePayloadSchema).optional(),
  scanLogs: z.array(z.string()).optional(),
});

export type CreateScanPayload = z.infer<typeof createScanPayloadSchema>;

/** A File document as returned inside the create response — no media URLs. */
export const scanFileRecordSchema = z.object({
  id: z.string(),
  filename: z.string(),
  filesize: z.number(),
  filetype: z.string(),
  filepath: z.string(),
  batchId: z.string().nullish(),
  originalFilename: z.string().nullish(),
  status: z.string().nullish(),
});

export type ScanFileRecord = z.infer<typeof scanFileRecordSchema>;

export const createScanResponseSchema = z.object({
  id: z.string(),
  /** Server-generated: `<ScanTypeName>-<MONDD>-<00001>`. */
  title: z.string(),
  user: userBasicSchema,
  scanType: scanTypeRefSchema,
  status: scanStatusSchema,
  fileTotal: z.number(),
  fileCount: z.number(),
  files: z.array(scanFileRecordSchema).default([]),
  fileDetails: z.array(fileDetailSchema).default([]),
  findings: z.array(scanFindingSchema).default([]),
  notes: z.array(embeddedScanNoteSchema).default([]),
  form: z.array(scanFormResponseSchema).default([]),
  tags: z.array(z.string()).default([]),
  scanIdentifier: z.string().nullish(),
  externalPatientId: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CreateScanResponse = z.infer<typeof createScanResponseSchema>;

/**
 * What POST /api/scan/:scanId/add-files and DELETE /api/scan/:scanId/files
 * both answer with: the whole updated scan as the raw Mongoose document.
 *
 * Only two fields matter to a caller and both are load-bearing rather than
 * informational. `files` carries the File records just created, whose ids are
 * what the per-file confirmation needs. `fileTotal` is read back rather than
 * predicted because both routes move it — add `$inc`s it by the number added,
 * delete `$inc`s it down by the number actually attached and then clamps at
 * zero — and the decision to destroy a draft hangs on that number being right.
 */
export const scanFilesMutationResponseSchema = z.object({
  fileTotal: z.number(),
  files: z.array(scanFileRecordSchema).default([]),
});

export type ScanFilesMutationResponse = z.infer<typeof scanFilesMutationResponseSchema>;

/** PATCH /api/scan/:scanId/file-details/status — matched by FILENAME, not id. */
export const fileDetailsStatusPayloadSchema = z.object({
  filename: z.string(),
  status: z.enum(['pending', 'completed', 'failed']),
  message: z.string().optional(),
});

export type FileDetailsStatusPayload = z.infer<typeof fileDetailsStatusPayloadSchema>;

export const fileDetailsStatusResponseSchema = z.object({
  filename: z.string(),
  status: z.string(),
});

/** POST /api/scan/v2/upload-presign. */
export const uploadPresignPayloadSchema = z.object({
  /**
   * Any valid 24-hex ObjectId. The route checks the FORMAT only — it never
   * looks the scan up — which is what lets the wizard start transferring bytes
   * before a scan record exists.
   */
  scanId: z.string(),
  /** Trailing filename segment; the server prepends the user/scan prefix. */
  key: z.string(),
  contentType: z.string(),
});

export const uploadPresignResponseSchema = z.object({
  url: z.string(),
  /** The full canonical S3 key. Send this back verbatim as `filepath`. */
  key: z.string(),
});

export type UploadPresignResponse = z.infer<typeof uploadPresignResponseSchema>;

/** POST /api/scan/v2/upload-init — multipart, for files above the part size. */
export const multipartUploadInitPayloadSchema = z.object({
  scanId: z.string(),
  key: z.string(),
  contentType: z.string(),
  totalParts: z.number().int().min(1).max(10_000).optional(),
});

export const multipartUploadInitResponseSchema = z.object({
  uploadId: z.string(),
  key: z.string(),
  presignedUrls: z.array(z.string()).optional(),
});

export type MultipartUploadInitResponse = z.infer<typeof multipartUploadInitResponseSchema>;

export const multipartUploadCompletePayloadSchema = z.object({
  key: z.string(),
  uploadId: z.string(),
  parts: z.array(z.object({ partNumber: z.number(), etag: z.string() })),
});

/**
 * PUT /api/file/:id/update.
 *
 * OMIT `filepath` when confirming an upload. The server rebuilds any filepath
 * it is given as `storage/{owner}/scan/{owningScan}/{trailing}` and 400s if no
 * object is there; with the field absent it verifies the path already stored
 * (the one create wrote verbatim), which is where the bytes actually are.
 * On the transition to `completed` it increments the scan's fileCount and,
 * once fileCount >= fileTotal, flips the scan to `submitted`.
 */
export const updateFilePayloadSchema = z.object({
  status: z.enum(['pending', 'completed', 'failed']),
  scanId: z.string().optional(),
  filename: z.string().optional(),
});

export type UpdateFilePayload = z.infer<typeof updateFilePayloadSchema>;

/**
 * PUT /api/scan/:scanId/update.
 *
 * The only route that sends the submission notifications. `notifyUser` alone
 * reaches the GROUP LEADERS (the server gates that on the status being
 * submitted/failed/failed_upload); the OWNER's email and push additionally
 * require the scan to have at least one `scanLogs` entry, which is why the
 * ids from POST /api/user-logs are passed with it.
 *
 * `scanLogs` is MERGED with what the scan already holds, never replaced.
 */
export const updateScanPayloadSchema = z.object({
  status: z
    .enum([
      'pending',
      'processing',
      'submitted',
      'failed',
      'failed_upload',
      'partially_uploaded',
      'reviewed',
    ])
    .optional(),
  scanIdentifier: z.string().nullish(),
  externalPatientId: z.string().max(100).nullish(),
  scanLogs: z.array(z.string()).optional(),
  notifyUser: z.boolean().optional(),
});

export type UpdateScanPayload = z.infer<typeof updateScanPayloadSchema>;
