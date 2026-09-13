import { z } from 'zod';

import { SCAN_STATUSES } from '../scan-status';
import { mediaFileSchema, scanGroupRefSchema, userBasicSchema } from './common';

/**
 * Scan shapes, checked field-by-field against live responses from
 * /api/scan/pending/list, /api/scan/reviewed/list and
 * /api/scan/reviewed/:id/get on the local gusi_dev database.
 *
 * Four legacy schema drifts are fixed here. Each one would have thrown on the
 * first render once runtime parsing was turned on:
 *
 *  1. `groups[]` is `{ _id, name }` on list routes and `{ id, name }` on detail
 *     routes. The legacy schema demanded a full GroupSchema and matched neither.
 *  2. `reviewDetails` is never sent by ANY scan route, not even the reviewed
 *     ones. The legacy schema declared it required-but-nullable.
 *  3. `notes[].user` is a populated object on the routes observed, but the list
 *     mapper can emit a bare ObjectId string, so it is modelled as a union.
 *  4. Several fields the legacy schema typed as optional strings arrive as
 *     explicit null: externalPatientId, processingError, acquisitionPointId,
 *     reviewText and friends.
 */

export const scanStatusSchema = z.enum(SCAN_STATUSES);

/**
 * The legacy import identifier carried on a scan, its review and its notes.
 *
 * VERIFIED DRIFT (2026-09-11, local gusi_dev): it is a NUMBER on scans
 * imported from the pre-GUSI system — `refId: 2704` on the three oldest rows
 * of /api/scan/pending/list — and null on everything created since. Typing it
 * as a string parsed fine on the newest page and threw on the oldest, which is
 * exactly the page the review queues open on: they default to longest-waiting
 * first, i.e. createdAt ASCENDING.
 *
 * Numbers are normalised to strings so the public `refId` type stays
 * `string | null | undefined` for every consumer. Nothing does arithmetic on
 * it; it is an opaque identifier that only ever gets displayed or compared.
 */
export const refIdSchema = z
  .union([z.string(), z.number().transform((value) => String(value))])
  .nullish();

export const scanFindingSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
});

export type ScanFinding = z.infer<typeof scanFindingSchema>;

/**
 * A dynamic-form answer as READ back from the server.
 *
 * The value union is wider than the legacy client's bare `string`: the server
 * accepts and stores string | string[] | number | boolean | Date | null, so a
 * checkbox or number field could not round-trip without stringifying it.
 */
export const scanFormValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

export const scanFormResponseSchema = z.object({
  formId: z.string(),
  scanFormFieldId: z.string(),
  value: scanFormValueSchema,
  submittedAt: z.string().optional(),
  _id: z.string().optional(),
  id: z.string().optional(),
});

export type ScanFormResponse = z.infer<typeof scanFormResponseSchema>;

/** The same answer as WRITTEN on create/update: no submittedAt, no ids. */
export const scanFormFieldPayloadSchema = z.object({
  formId: z.string(),
  scanFormFieldId: z.string(),
  value: scanFormValueSchema,
});

export type ScanFormFieldPayload = z.infer<typeof scanFormFieldPayloadSchema>;

const logActorSchema = z.union([z.string(), userBasicSchema.partial().passthrough()]);

/**
 * A scan carries BOTH `logs` (embedded, marked TO BE DEPRECATED server-side)
 * and `scanLogs`. On responses both hold expanded objects; on UPDATE payloads
 * `scanLogs` is an array of user-log ID STRINGS minted by POST /api/user-logs.
 * That request/response asymmetry is why the payload type is separate.
 */
export const scanLogSchema = z.object({
  action: z.string(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  message: z.string().optional(),
  author: logActorSchema.optional(),
  user: logActorSchema.optional(),
  details: z.unknown().optional(),
  dateCreated: z.string().optional(),
  createdAt: z.string().optional(),
});

export type ScanLog = z.infer<typeof scanLogSchema>;

/**
 * One of three parallel file collections on a scan:
 *   files        real File documents with presigned media URLs
 *   fileDetails  a client-supplied manifest, REPLACED wholesale when sent
 *   pendingFiles a server-side snapshot used only for the failed-upload panel
 *
 * PATCH /api/scan/:scanId/file-details/status matches an entry by FILENAME,
 * not by id, so two files with the same name in one scan are ambiguous.
 */
export const fileDetailSchema = z.object({
  batchId: z.string().optional(),
  filename: z.string(),
  filesize: z.number().optional(),
  filetype: z.string().optional(),
  filepath: z.string().optional(),
  originalFilename: z.string().nullish(),
  status: z.string().optional(),
  message: z.string().nullish(),
  _id: z.string().optional(),
  id: z.string().optional(),
});

export type FileDetail = z.infer<typeof fileDetailSchema>;

/**
 * VERIFIED DRIFT (2026-09-11, local gusi_dev): the model writes an explicit
 * `null` for `reason` — and, on some rows, for `assessment` — whenever it had
 * nothing to say about that probe axis. Requiring strings here threw on the
 * oldest page of /api/scan/pending/list, which is the page the review queues
 * open on (longest waiting first).
 */
const aiAssessmentItemSchema = z.object({
  view_name: z.string().nullish(),
  anatomy_name: z.string().nullish(),
  assessment: z.string().nullish(),
  reason: z.string().nullish(),
});

const aiTechnicalItemSchema = z.object({
  assessment: z.string().nullish(),
  reason: z.string().nullish(),
});

export const aiScanQualitySchema = z.object({
  required_view_assessments: z.array(aiAssessmentItemSchema).optional(),
  required_anatomy_assessments: z.array(aiAssessmentItemSchema).optional(),
  technical_assessment: z
    .object({
      probe_gain_assessment: aiTechnicalItemSchema.optional(),
      probe_depth_assessment: aiTechnicalItemSchema.optional(),
      probe_orientation_assessment: aiTechnicalItemSchema.optional(),
      probe_pressure_assessment: aiTechnicalItemSchema.optional(),
    })
    .optional(),
  acep_qa_assessment: aiTechnicalItemSchema.optional(),
});

export type AiScanQuality = z.infer<typeof aiScanQualitySchema>;

/** '' is a real stored value for competencyMeasure, alongside null. */
export const competencyMeasureSchema = z.enum(['achieved', 'not_achieved', '']);
export type CompetencyMeasure = z.infer<typeof competencyMeasureSchema>;

/**
 * competencyMeasure as READ BACK, which is wider than what may be written.
 *
 * VERIFIED DRIFT (2026-09-12, local gusi_dev): two scanreviews rows hold the
 * boolean `true` here, both on scan AAA-JAN21-00018, whose status is
 * `reviewed` — so it is reachable from a reviewed list. A bare enum throws on
 * that row and takes the entire page of twenty scans down with it. Anything
 * outside the enum therefore reads back as "not recorded": a single corrupt
 * row loses its own outcome rather than everyone else's.
 *
 * Writes stay strict — see `reviewCompetencyMeasureSchema`, which accepts only
 * 'achieved' and 'not_achieved' — so this tolerance cannot introduce new bad
 * values, only survive the ones already stored.
 */
const storedCompetencyMeasureSchema = z.preprocess(
  (value) => (value === 'achieved' || value === 'not_achieved' || value === '' ? value : null),
  competencyMeasureSchema.nullable(),
);

export const customReviewSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export const scanReviewSchema = z.object({
  id: z.string(),
  /** The scan ID as a string. Invalidate details off THIS, not off `id`. */
  scan: z.string(),
  user: userBasicSchema,
  competencyMeasure: storedCompetencyMeasureSchema,
  overAllFeed: z.string().nullish(),
  technicalFeed: z.string().nullish(),
  teachingPoints: z.string().nullish(),
  teachingContent: z.string().nullish(),
  acquisitionPointId: z.string().nullish(),
  acquisitionPointFeed: z.string().nullish(),
  customReviews: z.array(customReviewSchema).nullish(),
  remarks: z.string().nullish(),
  reviewText: z.string().nullish(),
  translatedReviewText: z.string().nullish(),
  reviewMD: z.string().nullish(),
  translatedReviewMD: z.string().nullish(),
  translatedLanguage: z.string().nullish(),
  reviewFacts: z.string().nullish(),
  refId: refIdSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ScanReview = z.infer<typeof scanReviewSchema>;

/** A note as embedded inside a scan. Differs from the /notes route shape. */
export const embeddedScanNoteSchema = z.object({
  id: z.string(),
  note: z.string(),
  /** Populated on the routes observed; the list mapper can emit a bare id. */
  user: z.union([z.string(), userBasicSchema]),
  createdAt: z.string(),
});

export type EmbeddedScanNote = z.infer<typeof embeddedScanNoteSchema>;

export const scanTypeRefSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  version: z.number().optional(),
  questions: z.array(z.string()).optional(),
  organization: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .passthrough()
    .nullish(),
});

export type ScanTypeRef = z.infer<typeof scanTypeRefSchema>;

/**
 * One schema for both the list item and the detail payload.
 *
 * The two responses were compared field-by-field against the live API. They
 * differ in four places: the group-ref key (`_id` vs `id`, normalised in
 * scanGroupRefSchema), the notes[].user union, the detail route's pendingFiles
 * fallback (a MediaFile with null urls), and `groups`, which ONLY the list
 * route sends. Splitting them would duplicate 30 fields to encode that.
 */
export const scanSchema = z.object({
  id: z.string(),
  title: z.string(),
  user: userBasicSchema,
  scanType: scanTypeRefSchema,

  status: scanStatusSchema,
  /** Why a `failed` scan failed, written for the uploader. Null otherwise. */
  processingError: z.string().nullish(),

  fileTotal: z.number(),
  fileCount: z.number(),
  files: z.array(mediaFileSchema).default([]),
  fileDetails: z.array(fileDetailSchema).default([]),
  pendingFiles: z.array(fileDetailSchema).default([]),

  findings: z.array(scanFindingSchema).default([]),
  notes: z.array(embeddedScanNoteSchema).default([]),
  form: z.array(scanFormResponseSchema).default([]),

  review: scanReviewSchema.nullish(),
  reviewedAt: z.string().nullish(),

  /**
   * ABSENT on the detail route, present on the list route - verified against
   * the live API, not assumed. So this cannot carry `.default([])`: that
   * turns a field the response never sent into the positive claim that the
   * study went to nobody, on the one decision submit cannot undo.
   */
  groups: z.array(scanGroupRefSchema).optional(),
  tags: z.array(z.string()).default([]),

  scanIdentifier: z.string().nullish(),
  externalPatientId: z.string().nullish(),
  refId: refIdSchema,
  isExpertScan: z.boolean().optional(),

  logs: z.array(scanLogSchema).default([]),
  scanLogs: z.array(scanLogSchema).default([]),

  aiScanQuality: aiScanQualitySchema.nullish(),
  aiScanQualityMd: z.string().nullish(),
  /**
   * Unmapped hole. The legacy client typed it `z.any()` too; nothing in the
   * local data has a non-null value to model against yet.
   */
  aiScanInterpretation: z.unknown().nullish(),

  dicomMetadata: z.unknown().nullish(),

  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Scan = z.infer<typeof scanSchema>;

/**
 * A note from GET /api/scan/:scanId/notes. NOT the same as the embedded note:
 * it carries a `scan` stub and updatedAt, and no note list is paginated.
 */
export const scanNoteSchema = z.object({
  id: z.string(),
  note: z.string(),
  user: userBasicSchema,
  scan: z
    .object({
      id: z.string(),
      title: z.string(),
    })
    .optional(),
  refId: refIdSchema,
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type ScanNote = z.infer<typeof scanNoteSchema>;

/**
 * GET /api/scan/:scanId/notes breaks the list convention: `{ totalItems, items }`
 * with no page/limit/totalPages. Given its own name so it is never mistaken
 * for Paginated<T>.
 */
export const scanNoteListSchema = z.object({
  totalItems: z.number(),
  items: z.array(scanNoteSchema),
});

export type ScanNoteList = z.infer<typeof scanNoteListSchema>;

/** GET /api/scan/users?type=pending|reviewed — flat array, not paginated. */
export const scanUserSchema = userBasicSchema;
export type ScanUser = z.infer<typeof scanUserSchema>;
