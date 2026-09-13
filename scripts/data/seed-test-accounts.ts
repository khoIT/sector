import { hashSync } from 'bcryptjs';
import { MongoClient, ObjectId, type Db, type Document } from 'mongodb';

import { assertLocalMirrorUri } from '../../packages/api-client/src/fidelity/mirror';

/**
 * Seed the four `@sector.test` accounts into a LOCAL database.
 *
 *   SECTOR_TEST_PASSWORD='…' pnpm tsx scripts/data/seed-test-accounts.ts [--db gusi_prod_mirror] [--remove]
 *
 * One account per role the product serves — learner, group leader, scan
 * reviewer, administrator — with a password YOU choose, so the app can be
 * driven end to end without the maintainer's private demo credentials. The
 * `@scanvault.test` demo accounts are left exactly as they are; where one
 * exists, the matching Sector account inherits its group memberships so it
 * sees the same queues (the leader and the reviewer each lead one group).
 *
 * On the production mirror the demo accounts lead nothing — their groups were
 * made locally and are in no dump — so there the leader and the reviewer are
 * attached to the group with the LARGEST review queue instead. That is the
 * production-scale account the plan asks for: a queue of thousands, not two.
 * Pass `--group <id>` to choose the group yourself.
 *
 * The learner is enrolled in EVERY course that has a published version — 170
 * or so on the mirror — because the dumps hold no enrolments at all and the
 * course surfaces have a case to prove: a learner with more than a hundred
 * enrolments must still find the hundred-and-first. Pass `--no-enrol` to skip.
 *
 * That enrolment is a PERSONAL one, and a personal enrolment cannot produce
 * four shapes the route really serves, each of which broke the client once:
 * a group-assigned row, a group course whose `expiresAt` key is absent
 * altogether (1,783 of the mirror's 2,969 live group courses), one whose
 * assignment has already lapsed under a live group and a live membership
 * (`expirationType: 'course_assignment'`), a quiz answered below its passing
 * mark (`status: 'failed'`), and a progress row from before the version pin
 * and two of the counters existed. So the learner also gets a small group of
 * its own holding three assignments, and two hand-written progress rows in
 * exactly the shapes the API writes. Pass `--no-fixtures` to skip those.
 *
 * Idempotent: re-running updates the password and memberships in place.
 * `--remove` deletes the four accounts and everything this script created for
 * them. Nothing here can reach the production cluster: the URI must be local.
 *
 * The password is never printed. It goes into the shell, not into a file.
 */

type Account = {
  email: string;
  userName: string;
  role: 'subscriber' | 'group_leader' | 'scan_reviewer' | 'administrator';
  firstName: string;
  lastName: string;
  /** Demo account whose group memberships this one copies. */
  membershipsFrom?: string;
};

const ACCOUNTS: readonly Account[] = [
  {
    email: 'learner@sector.test',
    userName: 'sector_learner',
    role: 'subscriber',
    firstName: 'Sector',
    lastName: 'Learner',
  },
  {
    email: 'leader@sector.test',
    userName: 'sector_leader',
    role: 'group_leader',
    firstName: 'Sector',
    lastName: 'Leader',
    membershipsFrom: 'leader@scanvault.test',
  },
  {
    email: 'reviewer@sector.test',
    userName: 'sector_reviewer',
    role: 'scan_reviewer',
    firstName: 'Sector',
    lastName: 'Reviewer',
    membershipsFrom: 'reviewer@scanvault.test',
  },
  {
    email: 'admin@sector.test',
    userName: 'sector_admin',
    role: 'administrator',
    firstName: 'Sector',
    lastName: 'Administrator',
  },
];

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const uri = arg('--uri', 'mongodb://localhost:27017/?directConnection=true') as string;
const dbName = arg('--db', 'gusi_prod_mirror') as string;
const remove = process.argv.includes('--remove');
const chosenGroup = arg('--group');
const enrol = !process.argv.includes('--no-enrol');
const fixtures = !process.argv.includes('--no-fixtures');

/** The learner's own group, so no production group is ever written to. */
const FIXTURE_GROUP_SLUG = 'sector-course-fixtures';

assertLocalMirrorUri(uri);
if (dbName === 'gusi' || dbName === 'gusi_test') {
  throw new Error(`refusing to seed '${dbName}': not a development database`);
}

/** The group with the most scans routed to it: the biggest queue a leader can hold. */
async function largestQueueGroup(db: Db): Promise<ObjectId | null> {
  const [top] = await db
    .collection('groupuserscans')
    .aggregate<{ _id: ObjectId; n: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: '$group', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ])
    .toArray();
  return top?._id ?? null;
}

/**
 * Enrol a user in every course that has a published version, pinned to that
 * version the way the API's own enrolment writes it (courseMetaVersion and
 * its number), so the learner routes resolve the same structure the API would.
 */
async function enrolInPublishedCourses(db: Db, userId: ObjectId, now: Date): Promise<number> {
  const versions = await db
    .collection('v2coursemetaversions')
    .aggregate<{ _id: ObjectId; versionId: ObjectId; version: number }>([
      { $match: { status: 'published', deletedAt: null } },
      { $sort: { version: -1 } },
      {
        $group: {
          _id: '$courseId',
          versionId: { $first: '$_id' },
          version: { $first: '$version' },
        },
      },
    ])
    .toArray();

  let enrolled = 0;
  for (const entry of versions) {
    const course = await db.collection('v2courses').findOne({ _id: entry._id, deletedAt: null });
    if (!course) continue;
    await db.collection('usercourses').updateOne(
      { user: userId, course: entry._id },
      {
        $set: {
          courseMetaVersion: entry.versionId,
          courseMetaVersionNumber: entry.version,
          status: 'active',
          expiresAt: null,
          deletedAt: null,
          updatedAt: now,
        },
        $setOnInsert: { enrolledAt: now, metadata: null, createdAt: now },
      },
      { upsert: true },
    );
    enrolled += 1;
  }
  return enrolled;
}

/**
 * Courses nothing else in this script will touch: no published version means
 * `enrolInPublishedCourses` skips them, so the group assignment below is the
 * learner's only route to them and the row cannot be deduplicated away by a
 * personal enrolment for the same course.
 */
async function coursesWithoutAPublishedVersion(db: Db, count: number): Promise<ObjectId[]> {
  const published = await db
    .collection('v2coursemetaversions')
    .distinct('courseId', { status: 'published', deletedAt: null });
  const publishedIds = published.map((id) => new ObjectId(String(id)));
  const courses = await db
    .collection('v2courses')
    .find({ deletedAt: null, _id: { $nin: publishedIds } })
    .sort({ _id: 1 })
    .limit(count)
    .toArray();
  return courses.map((course) => course._id as ObjectId);
}

/**
 * A group of the learner's own, holding the three group-course shapes.
 *
 * `expiresAt` is genuinely ABSENT on the first assignment rather than null:
 * that is the shape a `.lean()` read hands the API (a Mongoose default is not
 * applied to a document that never stored the key), and writing null here
 * instead would seed the one case that never failed.
 */
async function seedGroupAssignedCourses(db: Db, userId: ObjectId, now: Date): Promise<number> {
  // Two shapes are the point of this group — the absent key and the lapsed
  // assignment. A third, ordinary future expiry, is seeded when the database
  // has a course spare for it; the mirror has exactly two unpublished courses.
  const courseIds = await coursesWithoutAPublishedVersion(db, 3);
  if (courseIds.length < 2) {
    process.stdout.write(
      `  group fixtures skipped: ${dbName} holds ${courseIds.length} courses with no published version, needs 2\n`,
    );
    return 0;
  }

  const group = await db.collection('groups').findOneAndUpdate(
    { slug: FIXTURE_GROUP_SLUG },
    {
      $set: {
        name: 'Sector Course Fixtures',
        slug: FIXTURE_GROUP_SLUG,
        description: 'Group-assigned course shapes for local verification.',
        // One of the two values GROUP_TYPES holds; a fixture must not
        // invent a shape the fidelity replay would then have to excuse.
        type: 'group',
        expirationDate: null,
        deletedAt: null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: 'after' },
  );
  const groupId = (group as Document)._id as ObjectId;

  await db.collection('groupmembers').updateOne(
    { group: groupId, user: userId, role: 'learner' },
    {
      $set: { status: 'active', expiresAt: null, metadata: null, deletedAt: null, updatedAt: now },
      $setOnInsert: { joinedAt: now, createdAt: now },
    },
    { upsert: true },
  );

  const lapsed = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const assignments: Array<{ course: ObjectId; expiresAt?: Date | null }> = [
    // No expiresAt key at all — the majority shape, and the one that made the
    // whole list fail to parse with `Required` rather than with `null`.
    { course: courseIds[0] as ObjectId },
    // Lapsed under a live group and a live membership: the only path to
    // expirationType 'course_assignment'.
    { course: courseIds[1] as ObjectId, expiresAt: lapsed },
  ];
  const spare = courseIds[2];
  if (spare) assignments.push({ course: spare, expiresAt: future });

  for (const assignment of assignments) {
    const set: Document = { deletedAt: null, updatedAt: now };
    if ('expiresAt' in assignment) set.expiresAt = assignment.expiresAt;
    await db.collection('groupcourses').updateOne(
      { group: groupId, course: assignment.course },
      {
        // $unset, not `expiresAt: null`: re-running must leave the first
        // assignment without the key, not repair it into a null.
        ...('expiresAt' in assignment
          ? { $set: set }
          : { $set: set, $unset: { expiresAt: '' as const } }),
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  return assignments.length;
}

/**
 * Two progress rows the API's own writers produce and no dump holds.
 *
 * The first is a quiz answered in full below its passing mark, which
 * learners.quiz.track.ts stores as `status: 'failed'` on the item — the value
 * the outline serves straight through, and the one this client did not model.
 * The second is the legacy shape: a row written before
 * `courseMetaVersionNumber` and two of the counters existed, so the outline
 * reports a null version for it and the list sends a progress block with keys
 * missing rather than zeroed.
 *
 * Both only ever ADD. A progress row the learner already has is real state,
 * whether a previous run or a browser session wrote it.
 */
async function seedProgressFixtures(db: Db, userId: ObjectId, now: Date): Promise<number> {
  const taken = (
    await db.collection('usercourseprogresses').distinct('course', { user: userId })
  ).map((id) => String(id));
  const enrolments = await db.collection('usercourses').find({ user: userId }).toArray();
  const enrolled = new Map(enrolments.map((row) => [String(row.course), row]));

  // The quiz has to be one the learner's OWN pinned version carries, or the
  // outline will not have an item to hang the failed status on.
  const versions = await db
    .collection('v2coursemetaversions')
    .find({ status: 'published', deletedAt: null })
    .sort({ _id: 1 })
    .toArray();

  let failedCourseId: ObjectId | null = null;
  let failedQuizId: ObjectId | null = null;
  for (const version of versions) {
    const courseId = String(version.courseId);
    if (taken.includes(courseId) || !enrolled.has(courseId)) continue;

    const quizIds: ObjectId[] = [];
    const walk = (nodes: unknown): void => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes as Document[]) {
        if (node?.type === 'quiz' && node?.itemRef)
          quizIds.push(new ObjectId(String(node.itemRef)));
        walk(node?.items);
      }
    };
    walk((version.courseMeta as Document | undefined)?.structure);
    if (quizIds.length === 0) continue;

    // A quiz with no questions is blocked, not failable.
    const quiz = await db
      .collection('v2quizzes')
      .findOne({ _id: { $in: quizIds }, deletedAt: null, questions: { $exists: true, $ne: [] } });
    if (!quiz) continue;

    failedCourseId = new ObjectId(courseId);
    failedQuizId = quiz._id as ObjectId;
    break;
  }

  let written = 0;
  if (failedCourseId && failedQuizId) {
    const enrolment = enrolled.get(String(failedCourseId));
    const attemptStarted = new Date(now.getTime() - 20 * 60 * 1000);
    await db.collection('usercourseprogresses').insertOne({
      user: userId,
      course: failedCourseId,
      courseMetaVersion: enrolment?.courseMetaVersion ?? null,
      courseMetaVersionNumber: enrolment?.courseMetaVersionNumber ?? 1,
      status: 'in_progress',
      progress: 0,
      totalItems: 0,
      completedItems: 0,
      completedLessons: 0,
      completedTopics: 0,
      completedQuizzes: 0,
      totalTimeSpent: 1200,
      startedAt: attemptStarted,
      completedAt: null,
      lastAccessedAt: now,
      lastItemAccessed: failedQuizId,
      createdAt: now,
      updatedAt: now,
      items: [
        {
          _id: new ObjectId(),
          itemId: failedQuizId,
          wpId: null,
          type: 'quiz',
          status: 'failed',
          startedAt: attemptStarted,
          completedAt: null,
          lastAccessedAt: now,
          timeSpent: 1200,
          metadata: null,
          quizAttempts: [
            {
              _id: new ObjectId(),
              startedAt: attemptStarted,
              completedAt: now,
              score: 1,
              percentageScore: 25,
              totalPoints: 4,
              passed: false,
              timeSpent: 1200,
              answers: [],
              createdAt: attemptStarted,
              updatedAt: now,
            },
          ],
        },
      ],
    });
    taken.push(String(failedCourseId));
    written += 1;
  }

  // The pre-migration shape: no version pin, and no key at all for the two
  // counters that postdate the collection.
  const legacy = enrolments.find((row) => !taken.includes(String(row.course)));
  if (legacy) {
    await db.collection('usercourseprogresses').insertOne({
      user: userId,
      course: legacy.course as ObjectId,
      courseMetaVersion: null,
      courseMetaVersionNumber: null,
      status: 'in_progress',
      progress: 0,
      totalItems: 0,
      completedItems: 0,
      completedLessons: 0,
      completedQuizzes: 0,
      startedAt: now,
      completedAt: null,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now,
      items: [],
    });
    written += 1;
  }

  return written;
}

async function seed(db: Db, password: string): Promise<void> {
  const hash = hashSync(password, 10);
  const now = new Date();
  const fallbackGroup = chosenGroup ? new ObjectId(chosenGroup) : await largestQueueGroup(db);

  for (const account of ACCOUNTS) {
    const role = await db.collection('roles').findOne({ slug: account.role });
    if (!role) throw new Error(`role '${account.role}' is missing from ${dbName}.roles`);

    // Everything the User model requires, shaped the way the API itself writes
    // an account (copied from a demo account document, minus its secrets).
    const result = await db.collection('users').findOneAndUpdate(
      { email: account.email },
      {
        $set: {
          userName: account.userName,
          email: account.email,
          password: hash,
          firstName: account.firstName,
          lastName: account.lastName,
          middleName: '',
          cadre: 'Physician',
          role: role._id,
          status: 'active',
          deletedAt: null,
          updatedAt: now,
        },
        $setOnInsert: {
          profile: null,
          refId: null,
          googleId: null,
          appleId: null,
          stripeCustomerId: null,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    const user = result as Document | null;
    if (!user) throw new Error(`could not upsert ${account.email}`);
    const userId = user._id as ObjectId;

    let groups = 0;
    if (account.membershipsFrom) {
      const source = await db.collection('users').findOne({ email: account.membershipsFrom });
      let memberships: Document[] = source
        ? await db.collection('groupmembers').find({ user: source._id, deletedAt: null }).toArray()
        : [];

      // Nothing to inherit in this database: lead the largest queue instead.
      if (memberships.length === 0 && fallbackGroup) {
        memberships = [{ group: fallbackGroup, role: 'leader' }];
      }

      for (const membership of memberships) {
        await db.collection('groupmembers').updateOne(
          { group: membership.group, user: userId, role: membership.role },
          {
            $set: {
              status: 'active',
              expiresAt: null,
              metadata: null,
              deletedAt: null,
              updatedAt: now,
            },
            $setOnInsert: { joinedAt: now, createdAt: now },
          },
          { upsert: true },
        );
        groups += 1;

        // The API initialises a leader's notification preference when it adds
        // the membership; a seeded leader gets the same document.
        if (membership.role === 'leader') {
          await db.collection('groupnotifications').updateOne(
            { user: userId, group: membership.group },
            {
              $set: { emailNotifications: true, deletedAt: null, updatedAt: now },
              $setOnInsert: {
                notificationTypes: ['scan_created', 'scan_submitted'],
                createdAt: now,
              },
            },
            { upsert: true },
          );
        }
      }
    }

    const courses =
      enrol && account.role === 'subscriber' ? await enrolInPublishedCourses(db, userId, now) : 0;

    let assigned = 0;
    let progressRows = 0;
    if (fixtures && account.role === 'subscriber') {
      assigned = await seedGroupAssignedCourses(db, userId, now);
      progressRows = await seedProgressFixtures(db, userId, now);
    }

    process.stdout.write(
      `${account.email.padEnd(24)} ${account.role.padEnd(14)} ${String(userId)}  memberships ${groups}  courses ${courses}  group-assigned ${assigned}  progress ${progressRows}\n`,
    );
  }
}

async function unseed(db: Db): Promise<void> {
  const emails = ACCOUNTS.map((account) => account.email);
  const users = await db
    .collection('users')
    .find({ email: { $in: emails } })
    .toArray();
  const ids = users.map((user) => user._id);
  const members = await db.collection('groupmembers').deleteMany({ user: { $in: ids } });
  const notifications = await db
    .collection('groupnotifications')
    .deleteMany({ user: { $in: ids } });
  const enrolments = await db.collection('usercourses').deleteMany({ user: { $in: ids } });
  const progress = await db.collection('usercourseprogresses').deleteMany({ user: { $in: ids } });

  // The fixture group and its assignments are this script's own; no
  // production group is ever touched, so removing by slug cannot reach one.
  const fixtureGroup = await db.collection('groups').findOne({ slug: FIXTURE_GROUP_SLUG });
  let assignments = 0;
  if (fixtureGroup) {
    assignments = (
      await db.collection('groupcourses').deleteMany({ group: fixtureGroup._id as ObjectId })
    ).deletedCount;
    await db.collection('groupmembers').deleteMany({ group: fixtureGroup._id as ObjectId });
    await db.collection('groups').deleteOne({ _id: fixtureGroup._id as ObjectId });
  }

  const removed = await db.collection('users').deleteMany({ _id: { $in: ids } });
  process.stdout.write(
    `removed ${removed.deletedCount} accounts, ${members.deletedCount} memberships, ${notifications.deletedCount} notification preferences, ${enrolments.deletedCount} enrolments, ${progress.deletedCount} progress records, ${assignments} group assignments and the fixture group\n`,
  );
}

async function main(): Promise<void> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000 });
  await client.connect();
  try {
    const db = client.db(dbName);
    process.stdout.write(`${remove ? 'removing from' : 'seeding'} ${dbName}\n`);
    if (remove) {
      await unseed(db);
      return;
    }
    const password = process.env.SECTOR_TEST_PASSWORD;
    if (!password || password.length < 8) {
      throw new Error(
        'set SECTOR_TEST_PASSWORD (8+ characters) in the environment; it is never stored',
      );
    }
    await seed(db, password);
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
