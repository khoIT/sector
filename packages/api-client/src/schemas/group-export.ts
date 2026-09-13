import { z } from 'zod';

/**
 * The four generated group exports, all mounted under `/api/groups/manage`
 * (`manager.controller.ts`, gusi_nodejs_api) and all scoped server-side by
 * `groupMemberService.assertLeadsGroup` — see `endpoints/group-export.ts` for
 * the per-route citation.
 *
 * Every one of them answers a JSON envelope, never a binary body: `sendResponse`
 * always calls `res.send(JSON.stringify(data))`, even on the one route that
 * also sets `Content-Type: text/csv` (`getGroupReport`'s csv branch) — that
 * header is aspirational, not what actually goes over the wire. So this
 * client's ordinary JSON transport handles all five without a special binary
 * path; nothing here needs `response.blob()`.
 */

/**
 * `POST /export-scans/:groupId`, `/export-user-scans/:groupId`,
 * `/export-course-progress` and `/export-course-data/:groupId` all answer
 * this same shape (`createExcelResponseData`, xlsx.util.ts): a base64-encoded
 * workbook, decoded client-side into a download.
 *
 * The request body's `type: 'xlsx' | 'csv'` is accepted by all four schemas
 * but READ BY NONE of the four handlers — verified by reading
 * `manager.controller.ts`: `body.type` never appears outside the schema
 * files, so a `type: 'csv'` request still gets an xlsx workbook back. Modelled
 * as a constant `'xlsx'` in the endpoint layer rather than a client option, so
 * nobody builds a "download as CSV" button here that silently downloads xlsx.
 */
export const exportFileResultSchema = z.object({
  filename: z.string(),
  /** Base64-encoded workbook bytes. */
  buffer: z.string(),
  contentType: z.string(),
});

export type ExportFileResult = z.infer<typeof exportFileResultSchema>;

/**
 * `GET /report/:groupId?type=json` — the one export route that DOES honour
 * its `type` parameter (csv vs json), and the one whose json shape is a flat,
 * pre-formatted table rather than a workbook: one row per (class, course,
 * member), column names already human-readable because they are written
 * straight into a CSV header when `type=csv` is requested instead.
 */
export const groupScanReportEntrySchema = z.object({
  'Class Name': z.string(),
  'Course Name': z.string(),
  'Class Avg': z.string(),
  'First Name': z.string(),
  'Last Name': z.string(),
  Username: z.string(),
  Email: z.string(),
  'Completed Steps': z.string(),
  'Completion Date': z.string(),
  'Completion Percentage': z.string(),
});

export type GroupScanReportEntry = z.infer<typeof groupScanReportEntrySchema>;
