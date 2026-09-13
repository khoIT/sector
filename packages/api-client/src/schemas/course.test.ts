import { describe, expect, it } from 'vitest';

import { learnerCourseListItemSchema, learnerCourseProgressSchema } from './course';
import { courseOutlineItemSchema, courseOutlineSchema } from './course-outline';

/**
 * The four shapes that made a course surface unusable, each captured from the
 * running mirror API rather than written by hand.
 *
 * Every payload below is a verbatim response body from
 * `GET /api/v2/learners/courses` or `.../:courseId/outline` on the :5002
 * mirror, with one edit: `course.author` is replaced with the empty-author
 * record the API itself sends when an author reference does not resolve
 * (`resolveCourseAuthor`'s fallback, which 21 of 100 sampled rows already
 * carried). Author names and addresses belong to real people and do not
 * belong in a repository; nothing else is altered, and the fixtures that
 * produce these rows live in scripts/data/seed-test-accounts.ts.
 *
 * The point of each test is the shape, not the parse: before these schemas
 * were corrected, the first two failed the WHOLE My Courses page with
 * "Required" — not a missing badge, a page that would not render — and the
 * last two failed the whole outline.
 */

/** A group assignment whose GroupCourse document has no `expiresAt` key. */
const GROUP_ROW_WITHOUT_EXPIRES_AT = {
  id: '6aa6ee55091921b207e38717',
  assignmentType: 'group',
  group: {
    id: '6aa6ee55091921b207e38715',
    name: 'Sector Course Fixtures',
    slug: 'sector-course-fixtures',
    description: 'Group-assigned course shapes for local verification.',
    type: 'institution',
    membershipExpiresAt: null,
    courseAssignmentExpiresAt: null,
    isMembershipExpired: false,
    deletedAt: null,
    expirationDate: null,
    isGroupExpired: false,
  },
  course: {
    id: '681a4b74779a0d9e6c9cc5ba',
    title: 'Fellowship OB 1st Tri Module',
    slug: 'fellowship-ob-1st-tri-module',
    content: '',
    imageUrl: null,
    cmeCredits: '',
    cmeUrl: '',
    cmeCode: '',
    status: 'published',
    author: {
      _id: '',
      email: '',
      firstName: '',
      lastName: '',
    },
  },
  progress: {
    status: 'not_started',
    progress: 0,
    totalItems: 0,
    completedItems: 0,
    completedLessons: 0,
    completedTopics: 0,
    completedQuizzes: 0,
    totalTimeSpent: 0,
    startedAt: null,
    completedAt: null,
    lastAccessedAt: null,
  },
  courseMetaVersion: {
    id: '68de217bba4474a1858a4026',
    version: 1,
    status: 'draft',
    totalItems: 14,
    totalLessons: 1,
    totalTopics: 6,
    totalQuiz: 7,
  },
  enrolledAt: '2026-09-13T18:41:24.296Z',
  userCourseStatus: 'active',
  isExpired: false,
  expirationType: null,
};

/** A group assignment that lapsed under a live group and a live membership. */
const LAPSED_GROUP_ASSIGNMENT_ROW = {
  id: '6aa6ee55091921b207e38718',
  assignmentType: 'group',
  group: {
    id: '6aa6ee55091921b207e38715',
    name: 'Sector Course Fixtures',
    slug: 'sector-course-fixtures',
    description: 'Group-assigned course shapes for local verification.',
    type: 'institution',
    membershipExpiresAt: null,
    courseAssignmentExpiresAt: '2026-08-14T18:41:24.296Z',
    isMembershipExpired: false,
    deletedAt: null,
    expirationDate: null,
    isGroupExpired: false,
  },
  course: {
    id: '6838f5d7779320842166bc67',
    title: 'AI',
    slug: 'aiscan',
    content: '<p>ai sncan</p>',
    imageUrl: null,
    status: 'draft',
    author: {
      _id: '',
      email: '',
      firstName: '',
      lastName: '',
    },
  },
  progress: {
    status: 'not_started',
    progress: 0,
    totalItems: 0,
    completedItems: 0,
    completedLessons: 0,
    completedTopics: 0,
    completedQuizzes: 0,
    totalTimeSpent: 0,
    startedAt: null,
    completedAt: null,
    lastAccessedAt: null,
  },
  courseMetaVersion: {
    id: '',
    version: 1,
    status: 'draft',
    totalItems: 0,
    totalLessons: 0,
    totalTopics: 0,
    totalQuiz: 0,
  },
  enrolledAt: '2026-09-13T18:41:24.296Z',
  expiresAt: '2026-08-14T18:41:24.296Z',
  userCourseStatus: 'active',
  isExpired: true,
  expirationType: 'course_assignment',
};

/** A progress document written before two of the counters existed. */
const PRE_MIGRATION_PROGRESS = {
  status: 'in_progress',
  progress: 0,
  totalItems: 0,
  completedItems: 0,
  completedLessons: 0,
  completedQuizzes: 0,
  startedAt: '2026-09-13T18:41:24.296Z',
  completedAt: null,
  lastAccessedAt: '2026-09-13T18:41:24.296Z',
};

/** A quiz answered in full below its passing mark. */
const FAILED_QUIZ_ITEM = {
  id: '681a4ee04bc509ae575979c3',
  kind: 'quiz',
  title: 'PreCourse Quiz',
  depth: 1,
  parentId: '681a4d62acc6f28eaec5e1e7',
  lessonId: '681a4d62acc6f28eaec5e1e7',
  topicId: null,
  status: 'failed',
  completedAt: null,
  lastAccessedAt: '2026-09-13T18:41:24.296Z',
  blockedReason: null,
  quiz: {
    questionCount: 36,
    attempts: 1,
    bestPercentage: 25,
    passed: false,
  },
  order: 14,
  prevId: '681a4d62acc6f28eaec5e1e7',
  nextId: null,
};

/** An outline resolved without a version pin (items trimmed for length). */
const OUTLINE_WITHOUT_A_VERSION_PIN = {
  courseId: '69bdd60f2b7ea17fe980ddc6',
  courseMetaVersion: null,
  status: 'not_started',
  progress: 0,
  totalItems: 43,
  completedItems: 0,
  resume: {
    itemId: '681a4f0e4bc509ae57597ac7',
    kind: 'quiz',
  },
  items: [],
};

describe('a My Courses row the group branch builds', () => {
  it('parses when the group course carries no expiresAt key at all', () => {
    expect('expiresAt' in GROUP_ROW_WITHOUT_EXPIRES_AT).toBe(false);
    const parsed = learnerCourseListItemSchema.parse(GROUP_ROW_WITHOUT_EXPIRES_AT);
    // The model's own default, applied here because a .lean() read does not.
    expect(parsed.expiresAt).toBeNull();
  });

  it('parses an assignment that lapsed on its own expiry', () => {
    const parsed = learnerCourseListItemSchema.parse(LAPSED_GROUP_ASSIGNMENT_ROW);
    expect(parsed.expirationType).toBe('course_assignment');
    expect(parsed.isExpired).toBe(true);
  });

  it('still refuses an expiration type the route cannot produce', () => {
    const invented = { ...LAPSED_GROUP_ASSIGNMENT_ROW, expirationType: 'course_retired' };
    expect(learnerCourseListItemSchema.safeParse(invented).success).toBe(false);
  });
});

describe('the progress block of a My Courses row', () => {
  it('reads an absent counter as the zero the model declares', () => {
    expect('completedTopics' in PRE_MIGRATION_PROGRESS).toBe(false);
    const parsed = learnerCourseProgressSchema.parse(PRE_MIGRATION_PROGRESS);
    expect(parsed.completedTopics).toBe(0);
    expect(parsed.totalTimeSpent).toBe(0);
  });

  it('still refuses a counter of the wrong type', () => {
    const drifted = { ...PRE_MIGRATION_PROGRESS, completedItems: '3' };
    expect(learnerCourseProgressSchema.safeParse(drifted).success).toBe(false);
  });
});

describe('the resolved outline', () => {
  it('parses an item the learner failed', () => {
    const parsed = courseOutlineItemSchema.parse(FAILED_QUIZ_ITEM);
    expect(parsed.status).toBe('failed');
    expect(parsed.quiz?.passed).toBe(false);
  });

  it('parses an outline that resolved no version pin', () => {
    const parsed = courseOutlineSchema.parse(OUTLINE_WITHOUT_A_VERSION_PIN);
    expect(parsed.courseMetaVersion).toBeNull();
  });

  it('still refuses an item status the API has no value for', () => {
    const invented = { ...FAILED_QUIZ_ITEM, status: 'abandoned' };
    expect(courseOutlineItemSchema.safeParse(invented).success).toBe(false);
  });

  it('keeps the course-level status to the three a course can take', () => {
    const invented = { ...OUTLINE_WITHOUT_A_VERSION_PIN, status: 'failed' };
    expect(courseOutlineSchema.safeParse(invented).success).toBe(false);
  });
});
