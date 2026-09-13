import { z } from 'zod';

/**
 * My Courses — GET /api/v2/learners/courses.
 *
 * Modelled straight off `learnersService.getLearnerCourses()` and
 * `learners.controller.ts#getLearnersCourses` (gusi_nodejs_api), not off the
 * legacy dashboard's client-side-filtered 100-row fetch: the server does its
 * own keyword/status matching and its own pagination, and `expired` arrives
 * as a SEPARATE array beside `items` rather than mixed into it — a learner's
 * lapsed group assignment is not one more row in the active list.
 *
 * Checked against the seeded learner's own 115 enrolments on the production
 * mirror (`learner@sector.test`, `:5002`), 14 Sep 2026.
 */

/**
 * The three states `UserCourseProgress.status` actually takes
 * (`ProgressStatus` in the API). This is NOT the seven-value set the list
 * route's `status` FILTER accepts — that superset also covers the
 * enrolment-level `active | paused | dropped` and the derived `expired`,
 * which are not progress states at all. Keep the two apart: a request query
 * takes the wider set as a plain string, never this schema.
 */
export const COURSE_PROGRESS_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
export const courseProgressStatusSchema = z.enum(COURSE_PROGRESS_STATUSES);
export type CourseProgressStatus = z.infer<typeof courseProgressStatusSchema>;

/** `UserCourseStatus` — the enrolment's own lifecycle, independent of progress. */
export const ENROLLMENT_STATUSES = ['active', 'completed', 'dropped', 'paused'] as const;
export const enrollmentStatusSchema = z.enum(ENROLLMENT_STATUSES);
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;

export const ASSIGNMENT_TYPES = ['personal', 'group'] as const;
export const assignmentTypeSchema = z.enum(ASSIGNMENT_TYPES);
export type AssignmentType = z.infer<typeof assignmentTypeSchema>;

/**
 * Why a row counts as expired: the enrolment itself lapsed, the group
 * membership did, or the group did — `normalizeLearnerCourses()` in the
 * controller checks all three before it will drop a row into `expired`.
 */
export const EXPIRATION_TYPES = ['user_course', 'membership', 'group_expired'] as const;
export const expirationTypeSchema = z.enum(EXPIRATION_TYPES);
export type ExpirationType = z.infer<typeof expirationTypeSchema>;

const DURATION_UNITS = ['hours', 'days', 'weeks', 'months', 'years'] as const;
const courseDurationSchema = z.object({
  value: z.number(),
  unit: z.enum(DURATION_UNITS),
});

/** `CourseStatus` (v2 course model): the authoring lifecycle, not a learner's. */
const COURSE_STATUSES = ['published', 'draft', 'pending_review', 'hidden'] as const;
const courseStatusSchema = z.enum(COURSE_STATUSES);

/**
 * `resolveCourseAuthor()` keys this `_id`, not `id` — the one populated ref
 * on this route that is built by hand rather than through
 * `transformIdPlugin`'s toJSON, which is what renames `_id` everywhere else
 * in this package's schemas. Verified on the wire: every sampled course's
 * `author` carries a literal `_id` key.
 */
export const learnerCourseAuthorSchema = z.object({
  _id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
});
export type LearnerCourseAuthor = z.infer<typeof learnerCourseAuthorSchema>;

/**
 * The embedded course. `content`, `duration`, `cmeCredits`, `cmeUrl` and
 * `cmeCode` are genuinely ABSENT on the wire for a course whose document
 * never set them — confirmed against `v2courses/681a4b63779a0d9e6c9cc55b`
 * ("Pediatric Residency Essentials"), which carries none of the four keys —
 * so all five are `.optional()`, not defaulted. `imageUrl` is presigned per
 * request and is `null` for every course sampled locally (no seeded media).
 */
export const learnerCourseSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  content: z.string().optional(),
  imageUrl: z.string().nullable(),
  duration: courseDurationSchema.optional(),
  cmeCredits: z.string().nullish(),
  cmeUrl: z.string().nullish(),
  cmeCode: z.string().nullish(),
  status: courseStatusSchema,
  author: learnerCourseAuthorSchema,
});
export type LearnerCourseSummary = z.infer<typeof learnerCourseSummarySchema>;

/**
 * Assembled per learner-course pair by the controller (no stored document
 * matches this shape 1:1): `startedAt`/`completedAt`/`lastAccessedAt` are
 * `null`, not absent, when a course has never been opened.
 */
export const learnerCourseProgressSchema = z.object({
  status: courseProgressStatusSchema,
  progress: z.number(),
  totalItems: z.number(),
  completedItems: z.number(),
  completedLessons: z.number(),
  completedTopics: z.number(),
  completedQuizzes: z.number(),
  totalTimeSpent: z.number(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  lastAccessedAt: z.string().nullable(),
});
export type LearnerCourseProgress = z.infer<typeof learnerCourseProgressSchema>;

/**
 * The version's own totals — NOT the learner's progress, and NOT the plain
 * version number the outline route sends under the same field name. Two
 * routes, two shapes, one field name; do not conflate them (see
 * `course-outline.ts`'s `courseMetaVersion`, a bare number).
 */
export const learnerCourseMetaVersionSummarySchema = z.object({
  id: z.string(),
  version: z.number(),
  status: z.enum(['draft', 'published', 'archived', 'rejected']),
  totalItems: z.number(),
  totalLessons: z.number(),
  totalTopics: z.number(),
  totalQuiz: z.number(),
});
export type LearnerCourseMetaVersionSummary = z.infer<typeof learnerCourseMetaVersionSummarySchema>;

/**
 * Present only on a `group` assignment row; `null` on a `personal` one. The
 * three `is*Expired` booleans are what `normalizeLearnerCourses()` reads to
 * decide whether the row belongs in `items` or in `expired`.
 */
export const learnerCourseGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullish(),
  // Falls back to '' server-side when unset; not necessarily one of
  // `GROUP_TYPES` (schemas/group.ts), so left open rather than re-enumerated.
  type: z.string(),
  membershipExpiresAt: z.string().nullable(),
  courseAssignmentExpiresAt: z.string().nullable(),
  isMembershipExpired: z.boolean(),
  deletedAt: z.string().nullable(),
  expirationDate: z.string().nullable(),
  isGroupExpired: z.boolean(),
});
export type LearnerCourseGroup = z.infer<typeof learnerCourseGroupSchema>;

export const learnerCourseListItemSchema = z.object({
  id: z.string(),
  assignmentType: assignmentTypeSchema,
  group: learnerCourseGroupSchema.nullable(),
  course: learnerCourseSummarySchema,
  progress: learnerCourseProgressSchema,
  courseMetaVersion: learnerCourseMetaVersionSummarySchema,
  enrolledAt: z.string(),
  expiresAt: z.string().nullable(),
  userCourseStatus: enrollmentStatusSchema,
  isExpired: z.boolean(),
  expirationType: expirationTypeSchema.nullable(),
});
export type LearnerCourseListItem = z.infer<typeof learnerCourseListItemSchema>;

/**
 * The paginated envelope's `data`. Not `Paginated<T>` from `envelope.ts`:
 * this route adds `expired` beside `items`, which the generic shape does not
 * carry — same reasoning as `ScanNoteList` for `GET /api/scan/:id/notes`.
 */
export const learnerCoursesPageSchema = z.object({
  page: z.number(),
  totalPages: z.number(),
  totalItems: z.number(),
  limit: z.number(),
  items: z.array(learnerCourseListItemSchema),
  expired: z.array(learnerCourseListItemSchema),
});
export type LearnerCoursesPage = z.infer<typeof learnerCoursesPageSchema>;
