import type { Db, Document } from 'mongodb';

import type { ReplayContext } from '../replay';
import { pick, toWire, type RefCache } from '../wire';

/**
 * A My Courses row as `learnersService.getLearnerCourses` assembles it.
 *
 * The route has two branches and they build the same row shape from different
 * documents: one per UserCourse (a personal assignment) and one per
 * GroupCourse of every group the caller belongs to. Both are replayed, because
 * the fields that differ between them are exactly the fields that broke — the
 * group branch owns `expirationType: 'course_assignment'` and the `expiresAt`
 * that is absent rather than null on most group courses.
 *
 * Two joins the RefCache cannot express are indexed here instead: a version
 * document is looked up by id OR by (courseId, version 1), and a progress
 * document by (user, course). Both are small collections and both are read
 * once per replay run, keyed by the Db the run opened.
 */

type CourseIndexes = {
  /** v2coursemetaversions by id, and by `${courseId}:${version}`. */
  versionById: Map<string, Document>;
  versionByCourseAndNumber: Map<string, Document>;
  /** usercourseprogresses by `${user}:${course}`. */
  progressByUserCourse: Map<string, Document>;
};

/**
 * Resolved, not pending: `prefetch` is the only async hook the replay has, so
 * it loads these and `project` — which the harness calls synchronously — reads
 * them back.
 */
const indexesByDb = new WeakMap<Db, CourseIndexes>();

/**
 * The version documents carry the whole course structure; the row only needs
 * the seven summary fields, so the structure is left in the database.
 */
async function buildIndexes(db: Db): Promise<CourseIndexes> {
  const versionById = new Map<string, Document>();
  const versionByCourseAndNumber = new Map<string, Document>();
  const cursor = db.collection('v2coursemetaversions').find(
    {},
    {
      projection: {
        _id: 1,
        courseId: 1,
        version: 1,
        status: 1,
        totalItems: 1,
        totalLessons: 1,
        totalTopics: 1,
        totalQuiz: 1,
      },
    },
  );
  for await (const version of cursor) {
    versionById.set(String(version._id), version);
    versionByCourseAndNumber.set(`${String(version.courseId)}:${String(version.version)}`, version);
  }

  const progressByUserCourse = new Map<string, Document>();
  for await (const progress of db.collection('usercourseprogresses').find()) {
    progressByUserCourse.set(`${String(progress.user)}:${String(progress.course)}`, progress);
  }

  return { versionById, versionByCourseAndNumber, progressByUserCourse };
}

async function loadIndexes(db: Db): Promise<void> {
  if (indexesByDb.has(db)) return;
  indexesByDb.set(db, await buildIndexes(db));
}

function indexes(db: Db): CourseIndexes {
  const loaded = indexesByDb.get(db);
  if (!loaded) throw new Error('course indexes were not prefetched for this replay');
  return loaded;
}

/** `select: 'title slug content imageUrl duration cmeCredits cmeUrl cmeCode status author'`. */
const COURSE_FIELDS = [
  'title',
  'slug',
  'content',
  'imageUrl',
  'duration',
  'cmeCredits',
  'cmeUrl',
  'cmeCode',
  'status',
] as const;

/**
 * `resolveCourseAuthor()`: the one populated reference on this route that is
 * built by hand, so it keys `_id` rather than the `id` transformIdPlugin
 * writes everywhere else — and falls back to a record of empty strings when
 * the author reference does not resolve.
 */
export function learnerCourseAuthor(refs: RefCache, ref: unknown): unknown {
  const author = refs.get('users', ref);
  if (!author) return { _id: '', email: '', firstName: '', lastName: '' };
  return {
    _id: String(author._id),
    email: author.email ?? '',
    firstName: author.firstName ?? '',
    lastName: author.lastName ?? '',
  };
}

/** The embedded course object both branches build. */
export function learnerCourseSummary(refs: RefCache, course: Document): unknown {
  return {
    ...(toWire(pick(course, COURSE_FIELDS)) as Record<string, unknown>),
    // The service coalesces the title and the slug, and — unlike `content`,
    // `duration` and the three cme fields, which it passes through raw — it
    // coalesces the status to an empty string when a course has none.
    title: course.title ?? '',
    slug: course.slug ?? '',
    status: course.status || '',
    // getCloudfrontUrl presigns per request; a dump cannot replay that.
    imageUrl: null,
    author: learnerCourseAuthor(refs, course.author),
  };
}

/** The progress block for a learner-course pair with no progress document. */
const NOT_STARTED_PROGRESS = {
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
} as const;

/**
 * The stored counters, copied field by field the way the service does — which
 * is what makes a counter absent from the document absent from the wire.
 */
function progressBlock(progress: Document | undefined): unknown {
  if (!progress) return NOT_STARTED_PROGRESS;
  return {
    status: progress.status,
    progress: progress.progress,
    totalItems: progress.totalItems,
    completedItems: progress.completedItems,
    completedLessons: progress.completedLessons,
    completedTopics: progress.completedTopics,
    completedQuizzes: progress.completedQuizzes,
    totalTimeSpent: progress.totalTimeSpent,
    startedAt: toWire(progress.startedAt) ?? null,
    completedAt: toWire(progress.completedAt) ?? null,
    lastAccessedAt: toWire(progress.lastAccessedAt) ?? null,
  };
}

/** `{ id: '', version: 1, status: 'draft', ...zeroes }` when no version resolves. */
const NO_VERSION = {
  id: '',
  version: 1,
  status: 'draft',
  totalItems: 0,
  totalLessons: 0,
  totalTopics: 0,
  totalQuiz: 0,
} as const;

function versionBlock(version: Document | undefined): unknown {
  if (!version) return NO_VERSION;
  return {
    id: String(version._id),
    version: version.version,
    status: version.status,
    totalItems: version.totalItems,
    totalLessons: version.totalLessons,
    totalTopics: version.totalTopics,
    totalQuiz: version.totalQuiz,
  };
}

export async function prefetchPersonalCourses(
  _batch: Document[],
  { db, refs }: ReplayContext,
): Promise<void> {
  await Promise.all([refs.loadAll('users'), refs.loadAll('v2courses'), loadIndexes(db)]);
}

/** A UserCourse whose course document is gone is skipped by the service. */
export function personalCourseReachesTheList(
  userCourse: Document,
  { refs }: ReplayContext,
): boolean {
  return refs.get('v2courses', userCourse.course) !== null;
}

/** One UserCourse, as the personal branch of getLearnerCourses sends it. */
export function projectPersonalCourse(userCourse: Document, { db, refs }: ReplayContext): unknown {
  const { versionById, versionByCourseAndNumber, progressByUserCourse } = indexes(db);
  const course = refs.get('v2courses', userCourse.course) as Document;

  const courseId = String(course._id);
  const version =
    (userCourse.courseMetaVersion
      ? versionById.get(String(userCourse.courseMetaVersion))
      : undefined) ?? versionByCourseAndNumber.get(`${courseId}:1`);
  const progress = progressByUserCourse.get(`${String(userCourse.user)}:${courseId}`);
  const expiresAt = userCourse.expiresAt as Date | null | undefined;
  const isExpired = expiresAt ? expiresAt < new Date() : false;

  return {
    id: String(userCourse._id),
    assignmentType: 'personal',
    group: null,
    course: learnerCourseSummary(refs, course),
    progress: progressBlock(progress),
    courseMetaVersion: versionBlock(version),
    // Read straight off the lean document: absent in Mongo means absent from
    // the response, which is the shape the schema's defaults exist for.
    enrolledAt: toWire(userCourse.enrolledAt),
    expiresAt: toWire(expiresAt),
    userCourseStatus: userCourse.status,
    isExpired,
    expirationType: isExpired ? 'user_course' : null,
  };
}

export async function prefetchGroupCourses(
  _batch: Document[],
  { db, refs }: ReplayContext,
): Promise<void> {
  await Promise.all([
    refs.loadAll('users'),
    refs.loadAll('v2courses'),
    refs.loadAll('groups'),
    loadIndexes(db),
  ]);
}

/**
 * One GroupCourse, as the group branch sends it to a member.
 *
 * Two fields belong to the MEMBERSHIP rather than to this document —
 * `membershipExpiresAt` and `isMembershipExpired` — and a group course has
 * many members with different answers. They are replayed as the non-expiring
 * membership, which is both the common case and the only one that leaves the
 * row in the list: `normalizeLearnerCourses` drops a row whose membership has
 * lapsed, exactly as it drops one whose group has. What this entry proves, and
 * what no other test covered, is everything the GroupCourse itself decides —
 * above all its own `expiresAt`, present on barely a third of the collection.
 */
export function projectGroupCourse(groupCourse: Document, { db, refs }: ReplayContext): unknown {
  const { versionByCourseAndNumber } = indexes(db);
  const course = refs.get('v2courses', groupCourse.course) as Document;
  const group = refs.get('groups', groupCourse.group) as Document;

  const courseId = String(course._id);
  const now = new Date();
  const expiresAt = groupCourse.expiresAt as Date | null | undefined;
  const courseAssignmentExpired = expiresAt ? expiresAt < now : false;
  const expirationDate = (group.expirationDate ?? null) as Date | null;
  const isGroupExpired = expirationDate ? expirationDate < now : false;

  return {
    id: String(groupCourse._id),
    assignmentType: 'group',
    group: {
      id: String(group._id),
      name: group.name ?? '',
      slug: group.slug ?? '',
      description: toWire(group.description),
      type: group.type || '',
      membershipExpiresAt: null,
      courseAssignmentExpiresAt: toWire(expiresAt) ?? null,
      isMembershipExpired: false,
      deletedAt: toWire(group.deletedAt) ?? null,
      expirationDate: toWire(expirationDate) ?? null,
      isGroupExpired,
    },
    course: learnerCourseSummary(refs, course),
    // Per learner, and this row is per group: the branch every replayed
    // caller takes is the one with no progress document of their own.
    progress: NOT_STARTED_PROGRESS,
    // The group branch always resolves version 1, never the learner's pin.
    courseMetaVersion: versionBlock(versionByCourseAndNumber.get(`${courseId}:1`)),
    enrolledAt: toWire(groupCourse.createdAt ?? now),
    expiresAt: toWire(expiresAt),
    // Hard-coded by the service: a group assignment has no enrolment record
    // of its own to carry a lifecycle.
    userCourseStatus: 'active',
    isExpired: courseAssignmentExpired,
    expirationType: courseAssignmentExpired ? 'course_assignment' : null,
  };
}

/** A group whose own expiry has passed never reaches the list at all. */
export function groupCourseReachesTheList(groupCourse: Document, { refs }: ReplayContext): boolean {
  const group = refs.get('groups', groupCourse.group);
  if (!group || !refs.get('v2courses', groupCourse.course)) return false;
  const expirationDate = (group.expirationDate ?? null) as Date | null;
  // normalizeLearnerCourses drops a group row whose group is deleted or
  // expired before it decides which list the row belongs in.
  return !(expirationDate && expirationDate < new Date());
}
