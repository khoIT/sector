import { z } from 'zod';

import { SCAN_STATUSES, type ScanStatus, type StatusTone } from '../scan-status';
import { courseProgressStatusSchema, type CourseProgressStatus } from './course';

/**
 * The home-screen dashboards: course/scan progress charts, question-bank and
 * topic/quiz roll-ups, and the completion timeline.
 *
 * Every one of these routes is a COMPUTED aggregate (dashboard.controller.ts,
 * gusi_nodejs_api) rather than a stored document, so — like `learnerCourse*`
 * in `schemas/course.ts` — none of them has a single collection to replay.
 * `fidelity/manifest.ts` excuses them with the routes they are proved against
 * instead: `fidelity/dashboard-routes.fidelity.test.ts` walks all eight
 * through the running mirror API for every seeded role.
 *
 * The one rule every schema here follows: colour and translation come from a
 * **status code**, never from the English `label`/`name` string the wire also
 * sends. Two real bugs made that non-negotiable, both found by reading
 * `dashboard.controller.ts` rather than trusting the legacy (never-parsed)
 * frontend types:
 *
 *   1. `getChartsData`'s scan chart sends `data` in the FIXED order of a
 *      7-entry `scanStatuses` array, but `labels` is only 5 entries long — so
 *      zipping `labels[i]` with `data[i]` (every legacy dashboard did this)
 *      pairs "Submitted" with the `failed_upload` count, "Reviewed" with the
 *      `partially_uploaded` count, and silently drops the real submitted and
 *      reviewed counts entirely. `GROUP_SCAN_PROGRESS_STATUS_ORDER` below is
 *      that same fixed order, read by POSITION instead of by label, so all
 *      seven counts survive.
 *   2. Course-progress segments already carry a status `key` alongside the
 *      display `label` (`in_progress` / `completed` / `not_started`, always in
 *      that order) — the legacy dashboards read `label` anyway. Every
 *      `*_progress_status` field below is the enum, and callers must derive
 *      colour/i18n from it, never from a label.
 */

// ─── course / module progress ──────────────────────────────────────────────
//
// `COURSE_PROGRESS_STATUSES` / `courseProgressStatusSchema` are NOT redeclared
// here — `schemas/course.ts` already owns this exact three-value enum for My
// Courses' `learnerCourseProgressSchema.status`, and `dashboard.controller.ts`
// (verified) builds `courseProgressChart`/`groupCourseProgressChart` from the
// same status values, just always in `in_progress, completed, not_started`
// order rather than course.ts's `not_started, in_progress, completed` — order
// a `z.enum` never cares about.

/** One learner's own module breakdown for one course (`GET
 *  /api/dashboard/course-progress-chart`). `label` is carried for a raw
 *  fallback only — prefer `courseProgressStatusLabelKey(key)`. */
export const courseProgressSegmentSchema = z.object({
  key: courseProgressStatusSchema,
  label: z.string(),
  count: z.number(),
  totalModules: z.number(),
  percentage: z.number(),
  tooltipLabel: z.string(),
  legendLabel: z.string(),
});
export type CourseProgressSegment = z.infer<typeof courseProgressSegmentSchema>;

export const courseProgressChartSchema = z.object({
  data: z.array(z.number()).length(3),
  totalModules: z.number(),
  segments: z.array(courseProgressSegmentSchema).length(3),
});
export type CourseProgressChart = z.infer<typeof courseProgressChartSchema>;

/** The group variant (`GET /api/dashboard/charts`'s `courseProgressChart`)
 *  counts LEARNERS by overall course status, not one learner's modules — no
 *  `label` on its segment, by design of the route. */
export const groupCourseProgressSegmentSchema = z.object({
  key: courseProgressStatusSchema,
  count: z.number(),
  totalLearners: z.number(),
  percentage: z.number(),
  tooltipLabel: z.string(),
  legendLabel: z.string(),
});
export type GroupCourseProgressSegment = z.infer<typeof groupCourseProgressSegmentSchema>;

export const groupCourseProgressChartSchema = z.object({
  data: z.array(z.number()).length(3),
  totalLearners: z.number(),
  segments: z.array(groupCourseProgressSegmentSchema).length(3),
});
export type GroupCourseProgressChart = z.infer<typeof groupCourseProgressChartSchema>;

// ─── group scan progress (part of GET /api/dashboard/charts) ──────────────

/**
 * The exact order `getChartsData` builds `scanProgressChart.data` in — see
 * bug (1) in the module doc comment above. `.length()` on the schema turns a
 * future change to that order (or count) into a loud parse failure instead of
 * a silent relabelling.
 */
export const GROUP_SCAN_PROGRESS_STATUS_ORDER = [
  'pending',
  'processing',
  'failed',
  'failed_upload',
  'partially_uploaded',
  'submitted',
  'reviewed',
] as const satisfies readonly ScanStatus[];

export const groupScanProgressChartSchema = z.object({
  data: z.array(z.number()).length(GROUP_SCAN_PROGRESS_STATUS_ORDER.length),
});
export type GroupScanProgressChart = z.infer<typeof groupScanProgressChartSchema>;

/** One group's course + scan snapshot (`GET /api/dashboard/charts`). */
export const dashboardGroupChartsSchema = z.object({
  courseProgressChart: groupCourseProgressChartSchema,
  scanProgressChart: groupScanProgressChartSchema,
});
export type DashboardGroupCharts = z.infer<typeof dashboardGroupChartsSchema>;

export type DashboardGroupChartsQuery = {
  groupId: string;
  courseId?: string;
  role?: 'all' | 'leaders' | 'learners';
};

// ─── scan progress by user/group (GET /api/dashboard/scan-progress-by-user) ─

/**
 * Already code-clean on the wire: `getScanProgressByUser` sends `status` as
 * `statusKey` (the real enum), with `name` carrying the same English label
 * `scanProgressChart` above gets wrong the same way. Read `status`, ignore
 * `name` for anything but a raw fallback.
 */
export const scanProgressByUserItemSchema = z.object({
  name: z.string(),
  value: z.number(),
  status: z.enum(SCAN_STATUSES),
});
export type ScanProgressByUserItem = z.infer<typeof scanProgressByUserItemSchema>;

export const scanProgressByUserSchema = z.object({
  chartData: z.array(scanProgressByUserItemSchema),
  summary: z.object({
    totalScans: z.number(),
    completedScans: z.number(),
    failedScans: z.number(),
    pendingScans: z.number(),
    successRate: z.number(),
    failureRate: z.number(),
  }),
});
export type ScanProgressByUser = z.infer<typeof scanProgressByUserSchema>;

export type ScanProgressByUserQuery = {
  userId?: string;
  groupId?: string;
  startDate?: string;
  endDate?: string;
};

// ─── question bank stats (GET /api/dashboard/qbank-stats) ─────────────────

export const qbankStatsItemSchema = z.object({
  name: z.string(),
  slug: z.string(),
  quizId: z.string(),
  attempts: z.number(),
  highestScore: z.number(),
  lowestScore: z.number(),
  // `quiz.photoIcon || null` at the point this is built (dashboard.controller.ts).
  photoIcon: z.string().nullish(),
});
export type QBankStatsItem = z.infer<typeof qbankStatsItemSchema>;

export const qbankStatsSchema = z.object({
  chartData: z.array(qbankStatsItemSchema),
  summary: z.object({
    totalQuestionBanks: z.number(),
    totalAttempts: z.number(),
    averageScore: z.number(),
    highestOverallScore: z.number(),
    lowestOverallScore: z.number(),
  }),
});
export type QBankStats = z.infer<typeof qbankStatsSchema>;

export type QBankStatsQuery = {
  userId?: string;
  groupId?: string;
  courseId?: string;
  limit?: number;
};

// ─── topic progress (GET /api/dashboard/topic-progress-by-user) ───────────

export const topicProgressItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  // `lessonPathsMap.get(lessonId) || null` — required in the legacy schema,
  // but the controller sends null once a lesson has no resolvable path.
  path: z.string().nullish(),
  completionPercentage: z.number(),
  completedUsers: z.number(),
  completedItems: z.number(),
  totalItems: z.number(),
  totalUsers: z.number(),
  inProgressUsers: z.number(),
  notStartedUsers: z.number(),
  averageTimeSpent: z.string(),
});
export type TopicProgressItem = z.infer<typeof topicProgressItemSchema>;

export const topicProgressSchema = z.object({
  progressList: z.array(topicProgressItemSchema),
  summary: z.object({
    totalTopics: z.number(),
    averageCompletionRate: z.number(),
    topPerformingTopic: z.object({ title: z.string(), completionRate: z.number() }),
    lowestPerformingTopic: z.object({ title: z.string(), completionRate: z.number() }),
  }),
});
export type TopicProgress = z.infer<typeof topicProgressSchema>;

export type TopicProgressQuery = {
  userId?: string;
  groupId?: string;
  courseId?: string;
  limit?: number;
  page?: number;
};

// ─── quiz progress (GET /api/dashboard/quiz-progress-by-user) ─────────────

export const quizProgressItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  path: z.string().nullish(),
  photoIcon: z.string().nullish(),
  isQbank: z.boolean(),
  completionPercentage: z.number(),
  completedUsers: z.number(),
  totalUsers: z.number(),
  inProgressUsers: z.number(),
  notStartedUsers: z.number(),
  totalAttempts: z.number(),
  averageScore: z.number(),
  highestScore: z.number(),
  lowestScore: z.number(),
  passRate: z.number(),
  passedUsers: z.number(),
  failedUsers: z.number(),
  averageTimeSpent: z.string(),
});
export type QuizProgressItem = z.infer<typeof quizProgressItemSchema>;

export const quizProgressSchema = z.object({
  progressList: z.array(quizProgressItemSchema),
  summary: z.object({
    totalQuizzes: z.number(),
    averageCompletionRate: z.number(),
    overallAverageScore: z.number(),
    topPerformingQuiz: z.object({
      title: z.string(),
      completionRate: z.number(),
      averageScore: z.number(),
    }),
    lowestPerformingQuiz: z.object({
      title: z.string(),
      completionRate: z.number(),
      averageScore: z.number(),
    }),
  }),
});
export type QuizProgress = z.infer<typeof quizProgressSchema>;

export type QuizProgressQuery = {
  userId?: string;
  groupId?: string;
  courseId?: string;
  limit?: number;
  page?: number;
};

// ─── top course progress (GET /api/dashboard/top-course-progress) ─────────

export const topCourseProgressItemSchema = z.object({
  courseId: z.string(),
  courseName: z.string(),
  courseSlug: z.string(),
  progress: z.number(),
  completedItems: z.number(),
  totalItems: z.number(),
  status: courseProgressStatusSchema,
  lastAccessedAt: z.string().nullish(),
  timeSpent: z.number(),
  formattedTimeSpent: z.string().optional(),
});
export type TopCourseProgressItem = z.infer<typeof topCourseProgressItemSchema>;

export const topCourseProgressSchema = z.object({
  courses: z.array(topCourseProgressItemSchema),
  summary: z.object({
    totalCourses: z.number(),
    completedCourses: z.number(),
    inProgressCourses: z.number(),
    notStartedCourses: z.number(),
    averageProgress: z.number(),
    totalTimeSpent: z.string(),
  }),
});
export type TopCourseProgress = z.infer<typeof topCourseProgressSchema>;

export type TopCourseProgressQuery = {
  userId?: string;
  groupId?: string;
  limit?: number;
};

// ─── course completion timeline (GET /api/dashboard/course-completion-timeline) ─

export const courseCompletionTimelineEventSchema = z.object({
  /** e.g. 'item_started' | 'item_completed' | 'quiz_attempt_started' | … */
  type: z.string(),
  itemType: z.string().nullish(),
  itemId: z.string().nullish(),
  itemTitle: z.string().nullish(),
  status: z.string().nullish(),
  score: z.number().nullish(),
  passed: z.boolean().nullish(),
  timeSpent: z.number().nullish(),
  time: z.string(),
});
export type CourseCompletionTimelineEvent = z.infer<typeof courseCompletionTimelineEventSchema>;

export const courseCompletionTimelineDaySchema = z.object({
  date: z.string(),
  /** Completion percentage on this day (0-100). Named `value` on the wire —
   *  see `sendResponse`'s `chartData` mapping in `getCourseCompletionTimeline`,
   *  which is the point this was verified against, not the internal
   *  `completionPercentage` variable the controller computes it into. */
  value: z.number(),
  completedItems: z.number(),
  inProgressItems: z.number(),
  totalItems: z.number(),
  activitiesCount: z.number(),
  itemsStarted: z.number(),
  itemsCompleted: z.number(),
  quizAttempts: z.number(),
  quizCompletions: z.number(),
  events: z.array(courseCompletionTimelineEventSchema),
});
export type CourseCompletionTimelineDay = z.infer<typeof courseCompletionTimelineDaySchema>;

export const courseCompletionTimelineSchema = z.object({
  chartData: z.array(courseCompletionTimelineDaySchema),
  summary: z.object({
    currentProgress: z.number(),
    progressChange: z.number(),
    averageProgress: z.number(),
    peakProgress: z.number(),
    peakProgressDate: z.string().nullish(),
    totalItems: z.number(),
    completedItems: z.number(),
    // `userProgress.startedAt` / `.lastAccessedAt` straight off the Mongoose
    // document: nullable rather than the legacy schema's required string.
    startedDate: z.string().nullish(),
    lastAccessedDate: z.string().nullish(),
    statusBreakdown: z
      .object({ notStarted: z.number(), inProgress: z.number(), completed: z.number() })
      .optional(),
    error: z.string().optional(),
  }),
});
export type CourseCompletionTimeline = z.infer<typeof courseCompletionTimelineSchema>;

export type CourseCompletionTimelineQuery = {
  courseId: string;
  userId?: string;
  groupId?: string;
};

// ─── shared display helpers (status code → i18n key; never the wire label) ─

const COURSE_PROGRESS_STATUS_I18N_KEY: Record<CourseProgressStatus, string> = {
  in_progress: 'home.courseStatus.inProgress',
  completed: 'home.courseStatus.completed',
  not_started: 'home.courseStatus.notStarted',
};

/** i18next key for a course/module progress status code. Never branch on the
 *  wire's `label`/`legendLabel` strings — see the module doc comment. */
export function courseProgressStatusLabelKey(status: CourseProgressStatus): string {
  return COURSE_PROGRESS_STATUS_I18N_KEY[status];
}

const COURSE_PROGRESS_STATUS_TONE: Record<CourseProgressStatus, StatusTone> = {
  completed: 'ok',
  in_progress: 'warn',
  not_started: 'neutral',
};

/** Chart/pill tone for a course-progress status code — the same `StatusTone`
 *  union `scanStatusTone()` (below) returns, so a chart never has to know the
 *  difference between a course and a scan status when it colours a slice. */
export function courseProgressStatusTone(status: CourseProgressStatus): StatusTone {
  return COURSE_PROGRESS_STATUS_TONE[status];
}

const SCAN_PROGRESS_STATUS_I18N_KEY: Record<ScanStatus, string> = {
  pending: 'status.pending',
  processing: 'status.processing',
  submitted: 'status.submitted',
  failed: 'status.failed',
  failed_upload: 'status.failedUpload',
  partially_uploaded: 'status.partiallyUploaded',
  reviewed: 'status.reviewed',
};

/** i18next key for a scan status code, reusing the Scan Vault's own `status.*`
 *  namespace rather than a second, competing translation for the same words. */
export function scanProgressStatusLabelKey(status: ScanStatus): string {
  return SCAN_PROGRESS_STATUS_I18N_KEY[status];
}
