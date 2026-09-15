import { z } from 'zod';

import { displayText } from './decode-html-entities';

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
 * The three states a COURSE-level status takes. Every writer of
 * `UserCourseProgress.status` sets one of these — `recalculateProgressTotals`
 * derives it from the item counts, and `updateQuizProgressAndActivity` only
 * ever promotes `not_started` to `in_progress` — so the fourth value of the
 * API's `ProgressStatus` enum cannot reach a course-level field.
 *
 * This is NOT the seven-value set the list route's `status` FILTER accepts —
 * that superset also covers the enrolment-level `active | paused | dropped`
 * and the derived `expired`, which are not progress states at all. Keep the
 * two apart: a request query takes the wider set as a plain string, never
 * this schema.
 */
export const COURSE_PROGRESS_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
export const courseProgressStatusSchema = z.enum(COURSE_PROGRESS_STATUSES);
export type CourseProgressStatus = z.infer<typeof courseProgressStatusSchema>;

/**
 * The states a single ITEM's stored status takes, which is the course-level
 * set plus `failed`.
 *
 * `failed` is written by `learners.quiz.track.ts` (and
 * `userCourseProgressService.updateQuizProgressAndActivity`) the moment a
 * learner answers every question of a quiz and scores below its passing mark.
 * Nothing maps it away afterwards: the outline route reads
 * `UserCourseProgress.items[].status` straight through
 * `buildOutlineProgressItems`, so a four-value enum is what a learner who has
 * ever failed a quiz actually receives. Modelling it as three was a whole-page
 * failure for that learner, not a missing badge.
 */
export const COURSE_ITEM_PROGRESS_STATUSES = [...COURSE_PROGRESS_STATUSES, 'failed'] as const;
export const courseItemProgressStatusSchema = z.enum(COURSE_ITEM_PROGRESS_STATUSES);
export type CourseItemProgressStatus = z.infer<typeof courseItemProgressStatusSchema>;

/** `UserCourseStatus` — the enrolment's own lifecycle, independent of progress. */
export const ENROLLMENT_STATUSES = ['active', 'completed', 'dropped', 'paused'] as const;
export const enrollmentStatusSchema = z.enum(ENROLLMENT_STATUSES);
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;

export const ASSIGNMENT_TYPES = ['personal', 'group'] as const;
export const assignmentTypeSchema = z.enum(ASSIGNMENT_TYPES);
export type AssignmentType = z.infer<typeof assignmentTypeSchema>;

/**
 * Why a row counts as expired. Four values, not three: the enrolment itself
 * lapsed (`user_course`), the group membership did, the group did, or the
 * GROUP-COURSE ASSIGNMENT's own `expiresAt` passed (`course_assignment`).
 *
 * The last one is easy to miss because `normalizeLearnerCourses()` drops the
 * `membership` and `group_expired` rows before they reach `expired` — but it
 * has no rule for a lapsed course assignment under a live group and a live
 * membership, so that row is served, and it is the only one of the four this
 * client had never seen. 42 such assignments already exist on the mirror.
 */
export const EXPIRATION_TYPES = [
  'user_course',
  'membership',
  'group_expired',
  'course_assignment',
] as const;
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
 * Difficulty, closed server-side to these three. Kept an enum rather than a
 * string so a level can safely index a translation table; an unknown value
 * must fail here rather than reach the UI as a missing key.
 */
export const COURSE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const courseLevelSchema = z.enum(COURSE_LEVELS);
export type CourseLevel = z.infer<typeof courseLevelSchema>;

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
  title: displayText(),
  slug: z.string(),
  content: z.string().optional(),
  imageUrl: z.string().nullable(),
  duration: courseDurationSchema.optional(),
  cmeCredits: z.string().nullish(),
  cmeUrl: z.string().nullish(),
  cmeCode: z.string().nullish(),
  /**
   * Difficulty and learning objectives are authored, and no course carries
   * either today — all 175 documents predate the fields. So the real risk is
   * not a wrong value but an absent key on every single row, which is why
   * `level` is `.nullish()` and `objectives` defaults to an empty array: a
   * course list must not fail to parse because nobody has written content yet.
   */
  level: courseLevelSchema.nullish(),
  objectives: z.array(displayText()).default([]),
  status: courseStatusSchema,
  author: learnerCourseAuthorSchema,
});
export type LearnerCourseSummary = z.infer<typeof learnerCourseSummarySchema>;

/**
 * Assembled per learner-course pair by the controller (no stored document
 * matches this shape 1:1): `startedAt`/`completedAt`/`lastAccessedAt` are
 * `null`, not absent, when a course has never been opened — the service
 * coalesces those three itself.
 *
 * The counters are NOT coalesced: they are copied straight off a `.lean()`
 * UserCourseProgress, and a lean read does not apply a Mongoose default, so a
 * document written before a counter existed (`completedTopics` and
 * `totalTimeSpent` both postdate the collection — see the API's
 * migrate-user-progress-tracking-fields) arrives with the key ABSENT, not
 * zero. Each `.default()` here is the same default the model declares, so a
 * missing counter reads as the model would read it while a counter of the
 * wrong TYPE still fails loudly.
 */
export const learnerCourseProgressSchema = z.object({
  status: courseProgressStatusSchema.default('not_started'),
  progress: z.number().default(0),
  totalItems: z.number().default(0),
  completedItems: z.number().default(0),
  completedLessons: z.number().default(0),
  completedTopics: z.number().default(0),
  completedQuizzes: z.number().default(0),
  totalTimeSpent: z.number().default(0),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  lastAccessedAt: z.string().nullable(),
  /**
   * The item to reopen, resolved server-side to something a learner would
   * recognise. `.nullish()` rather than `.nullable()`: a stored progress
   * document written before this field existed has no key at all, and a My
   * Courses row is not worth failing to parse over a missing resume pointer.
   */
  lastItemAccessed: z
    .object({
      id: z.string(),
      title: displayText(),
      /** The playhead, for a topic carrying a video. Null for everything else. */
      positionSeconds: z.number().nullable(),
    })
    .nullish(),
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
  // `version` is the one field the model marks required; the totals and the
  // status all carry model defaults that a `.lean()` read does not apply, and
  // 43 of the mirror's 347 version documents predate the totals and have no
  // key for them. Same rule as the list item's own lean-read fields.
  version: z.number(),
  status: z.enum(['draft', 'published', 'archived', 'rejected']).default('draft'),
  totalItems: z.number().default(0),
  totalLessons: z.number().default(0),
  totalTopics: z.number().default(0),
  totalQuiz: z.number().default(0),
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
  // The three fields below are read straight off a `.lean()` UserCourse (the
  // personal branch) or GroupCourse, each of which declares a Mongoose
  // default that a lean read does NOT apply: an absent key reaches
  // JSON.stringify as `undefined` and is dropped from the response entirely.
  // 1,783 of the mirror's 2,969 live group courses have no `expiresAt` key at
  // all, which made `Required` — not `null` — the real failure. Each schema
  // default below is the model's own default.
  enrolledAt: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
  userCourseStatus: enrollmentStatusSchema.default('active'),
  isExpired: z.boolean(),
  expirationType: expirationTypeSchema.nullable(),
});
export type LearnerCourseListItem = z.infer<typeof learnerCourseListItemSchema>;

/**
 * `GET /api/v2/learners/courses/:courseId` — one enrolment, read for the
 * course landing page.
 *
 * Deliberately NARROW. The route also returns a `courseMetaVersion` carrying
 * the whole resolved structure plus every lesson, topic and quiz populated —
 * hundreds of kilobytes on a large course, and a second, competing definition
 * of an outline that `courseOutlineSchema` already owns. Zod strips unknown
 * keys, so declaring only what the landing page reads keeps one route from
 * growing a second outline shape nobody resolves navigation from.
 *
 * `course` is the SAME `learnerCourseSummarySchema` the list route embeds, so
 * a course cannot describe itself one way in My Courses and another way on
 * its own page.
 */
export const learnerCourseDetailsSchema = z.object({
  id: z.string(),
  assignmentType: assignmentTypeSchema,
  group: learnerCourseGroupSchema.nullable(),
  course: learnerCourseSummarySchema,
  progress: learnerCourseProgressSchema,
});
export type LearnerCourseDetails = z.infer<typeof learnerCourseDetailsSchema>;

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
