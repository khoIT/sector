import { z } from 'zod';

import { mediaFileSchema, userBasicSchema } from './common';
import { scanStatusSchema, scanTypeRefSchema } from './scan';

/**
 * GET /api/shared-scans — "scans shared WITH me".
 *
 * Deliberately NOT `scanSchema` for the nested scan. Verified against the live
 * response on 2026-09-11: the shared-scan mapper populates less than the scan
 * routes do, and `scanSchema` would throw on two fields:
 *
 *   - `scan.review.user` is a bare ObjectId STRING here, while
 *     `scanReviewSchema` requires a populated UserBasic.
 *   - `scan.scanLogs` is an array of ID STRINGS here, while `scanSchema`
 *     declares an array of log OBJECTS.
 *
 * So this file models only what the shared-scans LIST actually needs, and the
 * fields it does model were read off a real payload. The sharing dialog's
 * create/update/delete payloads belong in a separate `shared-scan.ts`.
 */

/** Share lifecycle, distinct from the underlying scan's own status. */
export const sharedScanStatusSchema = z.enum(['unopened', 'opened']);
export type SharedScanStatus = z.infer<typeof sharedScanStatusSchema>;

export const SHARED_SCAN_STATUS_LABEL: Record<SharedScanStatus, string> = {
  unopened: 'Unopened',
  opened: 'Opened',
};

/** The nested scan, trimmed to the columns the shared-scans table renders. */
export const sharedScanScanSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  user: userBasicSchema,
  scanType: scanTypeRefSchema,
  status: scanStatusSchema,
  fileTotal: z.number(),
  fileCount: z.number(),
  files: z.array(mediaFileSchema).default([]),
  tags: z.array(z.string()).default([]),
  scanIdentifier: z.string().nullish(),
  reviewedAt: z.string().nullish(),
  createdAt: z.string(),
});

export type SharedScanScanSummary = z.infer<typeof sharedScanScanSummarySchema>;

export const sharedScanListItemSchema = z.object({
  id: z.string(),
  scan: sharedScanScanSummarySchema,
  /** Recipient address the share was addressed to. */
  email: z.string(),
  sharedBy: userBasicSchema,
  status: sharedScanStatusSchema,
  remarks: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type SharedScanListItem = z.infer<typeof sharedScanListItemSchema>;
