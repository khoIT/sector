import { z } from 'zod';

import { userBasicSchema } from './common';

/**
 * The SHARING side of /api/shared-scans: granting, listing and revoking the
 * shares a user has created. The recipient-side list (`scans shared WITH me`)
 * has its own richer item schema in `schemas/shared-scan-list.ts`.
 *
 * A share is one row per RECIPIENT EMAIL, not one row per scan: sharing with
 * three people creates three records and revoking removes one recipient.
 *
 * The nested `scan` is modelled as `id`-only-and-passthrough on purpose. It
 * arrives fully populated here, but NOT in the shape `scanSchema` describes —
 * the shared-scan mapper populates less than the scan routes do, so
 * `scan.review.user` is a bare ObjectId string and `scan.scanLogs` is an array
 * of id strings. Parsing it as a Scan would throw. The sharing UI only needs
 * the id, so only the id is promised.
 */

/** Share lifecycle, distinct from the underlying scan's own status. */
const shareStatusSchema = z.enum(['unopened', 'opened']);

const shareScanRefSchema = z.union([z.string(), z.object({ id: z.string() }).passthrough()]);

export const scanShareSchema = z.object({
  id: z.string(),
  /** The recipient. A share is addressed by email, not by user id. */
  email: z.string(),
  status: shareStatusSchema,
  remarks: z.string().nullish(),
  sharedBy: z.union([z.string(), userBasicSchema]),
  scan: shareScanRefSchema,
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type ScanShare = z.infer<typeof scanShareSchema>;

export function scanShareScanId(share: ScanShare): string {
  return typeof share.scan === 'string' ? share.scan : share.scan.id;
}

export const createScanSharePayloadSchema = z.object({
  scan: z.string(),
  emails: z.array(z.string()).min(1),
  /** The sharer's user id. The server does not infer it from the token. */
  sharedBy: z.string(),
  remarks: z.string().optional(),
});

export type CreateScanSharePayload = z.infer<typeof createScanSharePayloadSchema>;

/**
 * The create response, which the legacy client mis-typed as a single record.
 *
 * Emails already shared land in `duplicateEmails` and emails with no registered
 * account land in `notFoundEmails`; both are skipped silently server-side, so
 * the UI has to surface them or the sharer believes a delivery happened that
 * never will. When NO email resolves, the server answers 400 instead.
 */
export const createScanShareResultSchema = z.object({
  sharedScans: z.array(scanShareSchema),
  duplicateEmails: z.array(z.string()),
  notFoundEmails: z.array(z.string()),
});

export type CreateScanShareResult = z.infer<typeof createScanShareResultSchema>;
