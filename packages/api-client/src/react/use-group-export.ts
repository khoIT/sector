import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';

import {
  exportGroupCourseData,
  exportGroupCourseProgress,
  exportGroupScans,
  exportGroupUserScans,
  getGroupScanReportCsv,
  getGroupScanReportJson,
  type ScanExportQuery,
} from '../endpoints/group-export';
import { groupKeys, mutationKeys } from '../query-keys';
import { useApiClient } from './api-provider';

/**
 * Every export is a mutation, not a query: each POST regenerates the workbook
 * on the server (nothing is cached or paginated), and triggering a download
 * is a one-shot action, not something a component re-renders to show.
 */

export function useExportGroupScansMutation(groupId: string) {
  const client = useApiClient();
  return useMutation({
    mutationKey: mutationKeys.exportGroupScans(),
    mutationFn: (query: ScanExportQuery = {}) => exportGroupScans(client, groupId, query),
  });
}

export function useExportGroupUserScansMutation(groupId: string) {
  const client = useApiClient();
  return useMutation({
    mutationKey: mutationKeys.exportGroupUserScans(),
    mutationFn: (query: ScanExportQuery = {}) => exportGroupUserScans(client, groupId, query),
  });
}

export function useExportGroupCourseProgressMutation() {
  const client = useApiClient();
  return useMutation({
    mutationKey: mutationKeys.exportGroupCourseProgress(),
    mutationFn: (groupIds: string[]) => exportGroupCourseProgress(client, groupIds),
  });
}

export function useExportGroupCourseDataMutation(groupId: string) {
  const client = useApiClient();
  return useMutation({
    mutationKey: mutationKeys.exportGroupCourseData(),
    mutationFn: (courseId: string) => exportGroupCourseData(client, groupId, courseId),
  });
}

/** The completion-report download, both formats — a query, not a mutation: GET, idempotent. */
export function useGroupScanReportDownload(groupId: string) {
  const client = useApiClient();

  return {
    downloadJson: (courseId?: string) => getGroupScanReportJson(client, groupId, courseId),
    downloadCsv: (courseId?: string) => getGroupScanReportCsv(client, groupId, courseId),
  };
}

/**
 * The completion report as DATA, for rendering on screen — the same route the
 * download uses, read as a query because a table re-renders from it.
 *
 * Deliberately the same route rather than a second one: a report a leader
 * reads and a report a leader exports that could disagree is worse than no
 * report at all.
 */
export function useGroupProgressReport(groupId: string, courseId?: string, enabled = true) {
  const client = useApiClient();

  return useQuery({
    queryKey: groupKeys.progressReport(groupId, courseId),
    queryFn: () => getGroupScanReportJson(client, groupId, courseId),
    enabled: enabled && groupId.length > 0,
    placeholderData: keepPreviousData,
  });
}
