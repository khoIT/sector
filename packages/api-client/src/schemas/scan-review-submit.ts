import { z } from 'zod';

import { customReviewSchema, scanReviewSchema } from './scan';

/**
 * Review SUBMISSION — POST /api/scan/:scanId/review.
 *
 * Separate from `schemas/scan-review-credits.ts`, which models the expert-review
 * credit economy (/api/scan-review/*). Different route family, different surface.
 *
 * VERIFIED DRIFT, and the reason the result is not plain `scanReviewSchema`:
 * the submit response returns `scan` as a POPULATED OBJECT (`{ title, id }`),
 * while every read route (`scan.review.scan` on
 * GET /api/scan/reviewed/:id/get) returns it as a bare id STRING. Confirmed
 * against the local API on 2026-09-11. Cache invalidation keys off the scan id,
 * so the union is normalised to the id string here.
 */
const reviewScanRefSchema = z
  .union([z.string(), z.object({ id: z.string() }).passthrough()])
  .transform((value) => (typeof value === 'string' ? value : value.id));

/**
 * The two values the server accepts on WRITE. Reads can additionally carry ''
 * for historic rows — see `competencyMeasureSchema` — but '' must never be
 * sent, so the write enum is deliberately narrower.
 */
export const REVIEW_COMPETENCY_MEASURES = ['achieved', 'not_achieved'] as const;
export const reviewCompetencyMeasureSchema = z.enum(REVIEW_COMPETENCY_MEASURES);
export type ReviewCompetencyMeasure = z.infer<typeof reviewCompetencyMeasureSchema>;

export const addScanReviewPayloadSchema = z.object({
  /**
   * Required by the product, nullable on the wire: the server would happily
   * store a review with no competency measure. The reviewer form enforces it.
   */
  competencyMeasure: reviewCompetencyMeasureSchema.nullable(),
  overAllFeed: z.string().optional(),
  technicalFeed: z.string().optional(),
  teachingPoints: z.string().optional(),
  teachingContent: z.string().optional(),
  acquisitionPointId: z.string().optional(),
  /** Non-empty creates a scan note attributed to the reviewer, as a side effect. */
  note: z.string().optional(),
  customReviews: z.array(customReviewSchema).optional(),
  /**
   * Expert queues only. It also unlocks re-reviewing an already-reviewed scan:
   * the server rejects a second review with 400 unless this is true.
   */
  isExpertScan: z.boolean().optional(),
});

export type AddScanReviewPayload = z.infer<typeof addScanReviewPayloadSchema>;

/** The created/updated review. `scan` is normalised to the scan id string. */
export const scanReviewResultSchema = scanReviewSchema.extend({
  scan: reviewScanRefSchema,
});

export type ScanReviewResult = z.infer<typeof scanReviewResultSchema>;
