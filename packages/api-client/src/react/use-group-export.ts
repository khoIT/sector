import { useMutation } from '@tanstack/react-query';

import {
  exportGroupCourseData,
  exportGroupCourseProgress,
  exportGroupScans,
  exportGroupUserScans,
  getGroupScanReportCsv,
  getGroupScanReportJson,
  type ScanExportQuery,
} from '../endpoints/group-export';
import { mutationKeys } from '../query-keys';
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
    downloadJson: () => getGroupScanReportJson(client, groupId),
    downloadCsv: () => getGroupScanReportCsv(client, groupId),
  };
}
