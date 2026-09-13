import type { ApiClient } from '../client';
import {
  qbankStatsSchema,
  quizProgressSchema,
  topicProgressSchema,
  type QBankStats,
  type QBankStatsQuery,
  type QuizProgress,
  type QuizProgressQuery,
  type TopicProgress,
  type TopicProgressQuery,
} from '../schemas/dashboard';

/**
 * Question-bank, topic and quiz roll-ups. Grouped in one file because all
 * three take the same `{userId?, groupId?, courseId?, limit?, page?}` shape
 * and answer the same question at three grains — attempts, content topics,
 * graded quizzes — for whichever home dashboard is asking.
 */

function pageQuery(query: {
  userId?: string;
  groupId?: string;
  courseId?: string;
  limit?: number;
  page?: number;
}): Record<string, string> {
  return {
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.groupId ? { groupId: query.groupId } : {}),
    ...(query.courseId ? { courseId: query.courseId } : {}),
    ...(query.limit ? { limit: String(query.limit) } : {}),
    ...(query.page ? { page: String(query.page) } : {}),
  };
}

/** GET /api/dashboard/qbank-stats */
export async function getDashboardQBankStats(
  client: ApiClient,
  query: QBankStatsQuery = {},
  signal?: AbortSignal,
): Promise<QBankStats> {
  return client.get('/api/dashboard/qbank-stats', {
    query: pageQuery(query),
    schema: qbankStatsSchema,
    signal,
  });
}

/** GET /api/dashboard/topic-progress-by-user */
export async function getDashboardTopicProgress(
  client: ApiClient,
  query: TopicProgressQuery = {},
  signal?: AbortSignal,
): Promise<TopicProgress> {
  return client.get('/api/dashboard/topic-progress-by-user', {
    query: pageQuery(query),
    schema: topicProgressSchema,
    signal,
  });
}

/** GET /api/dashboard/quiz-progress-by-user */
export async function getDashboardQuizProgress(
  client: ApiClient,
  query: QuizProgressQuery = {},
  signal?: AbortSignal,
): Promise<QuizProgress> {
  return client.get('/api/dashboard/quiz-progress-by-user', {
    query: pageQuery(query),
    schema: quizProgressSchema,
    signal,
  });
}
