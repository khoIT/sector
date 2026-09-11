import { z } from 'zod';

import {
  mediaFileSchema,
  scanGroupRefSchema,
  userBasicSchema,
} from './common';
import {
  fileDetailSchema,
  scanFindingSchema,
  scanFormResponseSchema,
  scanReviewSchema,
  scanStatusSchema,
  scanTypeRefSchema,
} from './scan';

/**
 * GET /api/shared-scans/:id — the RECIPIENT's read-only view of a shared scan.
 *
 * SIDE EFFECT: fetching it flips an `unopened` share to `opened`, and it 403s
 * for anyone but the recipient.
 *
 * The nested scan is NOT `scanSchema`, and swapping it for one would throw on
 * the first render. Verified against the live response on 2026-09-11: the
 * shared-scan mapper returns the raw Mongo document with only some paths
 * populated, so compared with the scan routes —
 *
 *   - `review.user` is a bare ObjectId STRING, not a populated user
 *   - `scanLogs` is an array of id STRINGS, not log objects
 *   - `notes[].scan` is a STRING, not the `{ id, title }` stub `scanNoteSchema`
 *     describes
 *   - `groups` is NULL rather than an array or absent
 *
 * Everything else lines up, so the shared pieces (media files, findings, form
 * answers, scan type) are reused rather than re-declared.
 */

/** The note shape as embedded here: user populated, `scan` a bare id string. */
const sharedScanNoteSchema = z.object({
  id: z.string(),
  note: z.string(),
  user: z.union([z.string(), userBasicSchema]),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type SharedScanNote = z.infer<typeof sharedScanNoteSchema>;

const sharedScanReviewSchema = scanReviewSchema.extend({
  user: z.union([z.string(), userBasicSchema]),
});

export const sharedScanDetailScanSchema = z.object({
  id: z.string(),
  title: z.string(),
  user: userBasicSchema,
  scanType: scanTypeRefSchema,
  status: scanStatusSchema,
  processingError: z.string().nullish(),

  fileTotal: z.number(),
  fileCount: z.number(),
  files: z.array(mediaFileSchema).default([]),
  fileDetails: z.array(fileDetailSchema).default([]),

  findings: z.array(scanFindingSchema).default([]),
  form: z.array(scanFormResponseSchema).default([]),
  notes: z.array(sharedScanNoteSchema).default([]),

  review: sharedScanReviewSchema.nullish(),
  reviewedAt: z.string().nullish(),

  /** Null on this route, unlike every /api/scan/* route where it is an array. */
  groups: z.array(scanGroupRefSchema).nullish(),
  tags: z.array(z.string()).default([]),

  scanIdentifier: z.string().nullish(),
  externalPatientId: z.string().nullish(),
  aiScanQualityMd: z.string().nullish(),

  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SharedScanDetailScan = z.infer<typeof sharedScanDetailScanSchema>;

export const sharedScanDetailSchema = z.object({
  id: z.string(),
  email: z.string(),
  status: z.enum(['unopened', 'opened']),
  remarks: z.string().nullish(),
  sharedBy: z.union([z.string(), userBasicSchema]),
  scan: sharedScanDetailScanSchema,
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type SharedScanDetail = z.infer<typeof sharedScanDetailSchema>;
