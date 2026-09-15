import { z } from 'zod';

import type { ApiClient } from '../client';
import { exportFileResultSchema, groupScanReportEntrySchema } from '../schemas/group-export';
import type { ExportFileResult, GroupScanReportEntry } from '../schemas/group-export';

/**
 * The four generated exports plus the one report route, all under
 * `/api/groups/manage`. See the module doc on `schemas/group-export.ts` for
 * why every one of these is a JSON-transport call, not a blob fetch, and why
 * `type`/`format` is not exposed as a caller-chosen option on the four
 * xlsx-only routes.
 */

export type ScanExportQuery = {
  /** Comma-separated scan type ids. Omitted = every scan type. */
  scanTypeIds?: string;
};

/** POST /export-scans/:groupId — one row per (member, scan type). */
export async function exportGroupScans(
  client: ApiClient,
  groupId: string,
  query: ScanExportQuery = {},
): Promise<ExportFileResult> {
  return client.post(`/api/groups/manage/export-scans/${groupId}`, {
    body: { scanTypeIds: query.scanTypeIds, type: 'xlsx' },
    schema: exportFileResultSchema,
  });
}

/** POST /export-user-scans/:groupId — one row per individual scan record. */
export async function exportGroupUserScans(
  client: ApiClient,
  groupId: string,
  query: ScanExportQuery = {},
): Promise<ExportFileResult> {
  return client.post(`/api/groups/manage/export-user-scans/${groupId}`, {
    body: { scanTypeIds: query.scanTypeIds, type: 'xlsx' },
    schema: exportFileResultSchema,
  });
}

/**
 * POST /export-course-progress — the one export route that takes MULTIPLE
 * group ids (`groupIds`, not a `:groupId` path param): the server checks
 * `assertLeadsGroup` for every id in the array before it builds the workbook,
 * so a caller cannot smuggle a group they do not lead into the list.
 */
export async function exportGroupCourseProgress(
  client: ApiClient,
  groupIds: string[],
): Promise<ExportFileResult> {
  return client.post('/api/groups/manage/export-course-progress', {
    body: { groupIds, type: 'xlsx' },
    schema: exportFileResultSchema,
  });
}

/** POST /export-course-data/:groupId — per-user module completion for ONE course. */
export async function exportGroupCourseData(
  client: ApiClient,
  groupId: string,
  courseId: string,
): Promise<ExportFileResult> {
  return client.post(`/api/groups/manage/export-course-data/${groupId}`, {
    body: { courseId, type: 'xlsx' },
    schema: exportFileResultSchema,
  });
}

/** GET /report/:groupId?type=json — completion by class/course/member. */
export async function getGroupScanReportJson(
  client: ApiClient,
  groupId: string,
  courseId?: string,
): Promise<GroupScanReportEntry[]> {
  return client.get(`/api/groups/manage/report/${groupId}`, {
    query: { type: 'json', ...(courseId ? { courseId } : {}) },
    schema: z.array(groupScanReportEntrySchema),
  });
}

/**
 * GET /report/:groupId?type=csv — the same report, pre-rendered as CSV text.
 * Not parsed against a shape: it is exactly the JSON report's rows joined
 * with commas server-side (`getGroupReport`'s csv branch), so there is
 * nothing structural to validate beyond "this is a string".
 */
export async function getGroupScanReportCsv(
  client: ApiClient,
  groupId: string,
  courseId?: string,
): Promise<string> {
  return client.get(`/api/groups/manage/report/${groupId}`, {
    query: { type: 'csv', ...(courseId ? { courseId } : {}) },
    schema: z.string(),
  });
}
