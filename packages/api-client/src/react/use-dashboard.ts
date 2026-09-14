import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  getDashboardCourseCompletionTimeline,
  getDashboardCourseProgress,
  getDashboardTopCourseProgress,
} from '../endpoints/dashboard-course-charts';
import { getDashboardGroupCharts } from '../endpoints/dashboard-group-charts';
import {
  getDashboardQBankStats,
  getDashboardQuizProgress,
  getDashboardTopicProgress,
} from '../endpoints/dashboard-learning-progress';
import { getDashboardScanProgress } from '../endpoints/dashboard-scan-progress';
import { dashboardKeys } from '../query-keys';
import type {
  CourseCompletionTimelineQuery,
  DashboardGroupChartsQuery,
  QBankStatsQuery,
  QuizProgressQuery,
  ScanProgressByUserQuery,
  TopCourseProgressQuery,
  TopicProgressQuery,
} from '../schemas/dashboard';
import { useApiClient } from './api-provider';

/**
 * The home-screen dashboards' data. Every hook here is a thin cache wrapper —
 * the four dashboard components decide what to ask for (self, a group, a
 * course); none of these hooks re-shapes or re-filters what the server sends.
 */

export function useDashboardCourseProgress(
  query: { courseId: string; userId?: string; groupId?: string } | undefined,
  enabled = true,
) {
  const client = useApiClient();
  return useQuery({
    queryKey: dashboardKeys.courseProgress(query ?? { courseId: '' }),
    queryFn: ({ signal }) => getDashboardCourseProgress(client, query!, signal),
    enabled: enabled && Boolean(query?.courseId),
    placeholderData: keepPreviousData,
  });
}

export function useDashboardTopCourseProgress(query: TopCourseProgressQuery = {}, enabled = true) {
  const client = useApiClient();
  return useQuery({
    queryKey: dashboardKeys.topCourseProgress(query),
    queryFn: ({ signal }) => getDashboardTopCourseProgress(client, query, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useDashboardCourseCompletionTimeline(
  query: CourseCompletionTimelineQuery | undefined,
  enabled = true,
) {
  const client = useApiClient();
  return useQuery({
    queryKey: dashboardKeys.courseCompletionTimeline(query ?? { courseId: '' }),
    queryFn: ({ signal }) => getDashboardCourseCompletionTimeline(client, query!, signal),
    enabled: enabled && Boolean(query?.courseId),
    placeholderData: keepPreviousData,
  });
}

export function useDashboardGroupCharts(
  query: DashboardGroupChartsQuery | undefined,
  enabled = true,
) {
  const client = useApiClient();
  return useQuery({
    queryKey: dashboardKeys.groupCharts(query ?? { groupId: '' }),
    queryFn: ({ signal }) => getDashboardGroupCharts(client, query!, signal),
    enabled: enabled && Boolean(query?.groupId),
    placeholderData: keepPreviousData,
  });
}

export function useDashboardScanProgress(query: ScanProgressByUserQuery = {}, enabled = true) {
  const client = useApiClient();
  return useQuery({
    queryKey: dashboardKeys.scanProgress(query),
    queryFn: ({ signal }) => getDashboardScanProgress(client, query, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useDashboardQBankStats(query: QBankStatsQuery = {}, enabled = true) {
  const client = useApiClient();
  return useQuery({
    queryKey: dashboardKeys.qbankStats(query),
    queryFn: ({ signal }) => getDashboardQBankStats(client, query, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useDashboardTopicProgress(query: TopicProgressQuery = {}, enabled = true) {
  const client = useApiClient();
  return useQuery({
    queryKey: dashboardKeys.topicProgress(query),
    queryFn: ({ signal }) => getDashboardTopicProgress(client, query, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useDashboardQuizProgress(query: QuizProgressQuery = {}, enabled = true) {
  const client = useApiClient();
  return useQuery({
    queryKey: dashboardKeys.quizProgress(query),
    queryFn: ({ signal }) => getDashboardQuizProgress(client, query, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}
