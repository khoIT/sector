import { z } from 'zod';

import { assignmentTypeSchema, courseProgressStatusSchema } from './course';

/**
 * The read-only admin/leader view of one learner's course —
 * `GET /dashboard/learner-course-detail?userId=&courseId=`
 * (`gusi_nodejs_api/src/app/dashboard/dashboard.controller.ts#getLearnerCourseDetail`,
 * backed by `learnersService.getLearnerCourseDetails`, the same method the
 * pre-Phase-6 `GET /v2/learners/courses/:courseId` route called before the
 * outline replaced it for the LEARNER's own view).
 *
 * Server-enforced access: `full-access`, or `group:leader-access` scoped to a
 * group the caller actually leads and the target learner is actually in —
 * this client only mirrors that with `canAny(['full-access', 'group:leader-access'])`
 * so the route names the missing permission instead of 403ing silently; the
 * server re-checks group overlap regardless.
 *
 * This is the aggregate/enrolment view only, not a per-item breakdown: the
 * service method also returns a populated `courseMetaVersion.lessons/topics/quizzes`
 * tree, but building that join correctly (it re-merges each item against the
 * learner's OWN progress items, separately from how the Phase 6 outline
 * builder does it) is out of this phase's scope — see the phase report. Only
 * the fields below are parsed; the rest of the route's payload is dropped.
 */

const adminCourseSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  imageUrl: z.string().nullable(),
  status: z.string(),
});

const adminCourseMetaVersionSchema = z.object({
  id: z.string(),
  version: z.number(),
  status: z.string(),
  totalItems: z.number(),
  totalLessons: z.number(),
  totalTopics: z.number(),
  totalQuiz: z.number(),
});

const adminCourseProgressSchema = z.object({
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

/** Present only on a `group` assignment row — a smaller shape than the My
 *  Courses list's own `learnerCourseGroupSchema` (no expiry-derived booleans
 *  beyond `isMembershipExpired`): read straight off `learners.service.ts`'s
 *  `groupInfo` object, which the admin route builds independently of the
 *  My Courses list's `normalizeLearnerCourses()`. */
const adminCourseGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullish(),
  type: z.string(),
  membershipExpiresAt: z.string().nullable(),
  courseAssignmentExpiresAt: z.string().nullable(),
  isMembershipExpired: z.boolean(),
});

const adminUserCourseSchema = z.object({
  id: z.string(),
  status: z.string(),
  enrolledAt: z.string(),
  expiresAt: z.string().nullable(),
  isExpired: z.boolean(),
});

export const learnerCourseAdminDetailSchema = z.object({
  id: z.string(),
  assignmentType: assignmentTypeSchema,
  group: adminCourseGroupSchema.nullable(),
  course: adminCourseSummarySchema,
  courseMetaVersion: adminCourseMetaVersionSchema.nullable(),
  progress: adminCourseProgressSchema,
  userCourse: adminUserCourseSchema.nullable(),
});
export type LearnerCourseAdminDetail = z.infer<typeof learnerCourseAdminDetailSchema>;

export const learnerCourseAdminResultSchema = z.object({
  learner: z.object({ id: z.string(), name: z.string() }),
  courseDetail: learnerCourseAdminDetailSchema,
});
export type LearnerCourseAdminResult = z.infer<typeof learnerCourseAdminResultSchema>;
