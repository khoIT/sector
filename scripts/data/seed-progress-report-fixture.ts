import { MongoClient, ObjectId, type Db } from 'mongodb';

import { assertLocalMirrorUri } from '../../packages/api-client/src/fidelity/mirror';

/**
 * Seed a group large enough to measure the course-progress report against.
 *
 *   pnpm tsx scripts/data/seed-progress-report-fixture.ts [--db gusi_dev]
 *     [--members 719] [--courses 3] [--leader leader@sector.test] [--remove]
 *
 * The report's cost is members times courses, and the largest real group holds
 * 719 learners. No group in a local dump combines that many members with any
 * courses at all — the 719-member one carries none, so it reports nothing and
 * measures nothing. This builds the missing shape: a full roster, several
 * courses, and a spread of progress across it.
 *
 * Everything it writes is marked, so `--remove` takes it all back out and
 * nothing else: the group carries a fixed slug, and its learners carry
 * addresses under one fixture domain. Idempotent — re-running resizes the
 * roster in place rather than stacking a second one.
 *
 * Local only. The URI is checked before anything is written.
 */

const GROUP_SLUG = 'progress-report-perf-fixture';
const GROUP_NAME = 'Progress Report Perf Fixture';
const LEARNER_DOMAIN = 'progress-fixture.test';
const ITEMS_PER_COURSE = 20;

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const uri = arg('--uri', 'mongodb://localhost:27017/?directConnection=true') as string;
const dbName = arg('--db', 'gusi_dev') as string;
const memberCount = Number(arg('--members', '719'));
const courseCount = Number(arg('--courses', '3'));
const leaderEmail = arg('--leader', 'leader@sector.test') as string;
const remove = process.argv.includes('--remove');

assertLocalMirrorUri(uri);
if (dbName === 'gusi' || dbName === 'gusi_test') {
  throw new Error(`refusing to seed '${dbName}': not a development database`);
}
if (!Number.isInteger(memberCount) || memberCount < 1) {
  throw new Error(`--members must be a positive integer, got ${arg('--members')}`);
}

async function findGroup(db: Db) {
  return db.collection('groups').findOne({ slug: GROUP_SLUG });
}

async function removeFixture(db: Db): Promise<void> {
  const group = await findGroup(db);
  const learners = await db
    .collection('users')
    .find({ email: { $regex: `@${LEARNER_DOMAIN}$` } }, { projection: { _id: 1 } })
    .toArray();
  const learnerIds = learners.map((user) => user._id);

  if (group) {
    const courses = await db
      .collection('groupcourses')
      .find({ group: group._id }, { projection: { course: 1 } })
      .toArray();
    const courseIds = courses.map((row) => row.course);

    await db.collection('groupcourses').deleteMany({ group: group._id });
    await db.collection('groupmembers').deleteMany({ group: group._id });
    await db.collection('v2coursemetas').deleteMany({ course: { $in: courseIds } });
    await db.collection('v2courses').deleteMany({ _id: { $in: courseIds } });
    await db.collection('groups').deleteOne({ _id: group._id });
    console.log(`removed group ${GROUP_SLUG} and ${courseIds.length} of its courses`);
  }

  await db.collection('usercourseprogresses').deleteMany({ user: { $in: learnerIds } });
  await db.collection('users').deleteMany({ _id: { $in: learnerIds } });
  console.log(`removed ${learnerIds.length} fixture learners`);
}

async function seedCourses(db: Db, groupId: ObjectId): Promise<ObjectId[]> {
  const ids: ObjectId[] = [];

  for (let index = 0; index < courseCount; index += 1) {
    const slug = `${GROUP_SLUG}-course-${index + 1}`;
    const existing = await db.collection('v2courses').findOne({ slug });
    const courseId = existing?._id ?? new ObjectId();

    if (!existing) {
      await db.collection('v2courses').insertOne({
        _id: courseId,
        title: `Perf Fixture Course ${index + 1}`,
        slug,
        status: 'published',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const structure = Array.from({ length: ITEMS_PER_COURSE }, () => ({
      itemRef: new ObjectId(),
      type: 'lesson',
    }));

    await db.collection('v2coursemetas').updateOne(
      { course: courseId },
      {
        $set: {
          course: courseId,
          structure,
          totalItems: ITEMS_PER_COURSE,
          totalLessons: ITEMS_PER_COURSE,
          totalQuiz: 0,
          totalTopics: 0,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );

    await db.collection('groupcourses').updateOne(
      { group: groupId, course: courseId },
      {
        $set: { group: groupId, course: courseId, deletedAt: null, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );

    ids.push(courseId);
  }

  return ids;
}

/**
 * A roster that is not uniform: some never opened the course, some are part
 * way, some finished. A report measured against learners who all look alike
 * would miss the per-learner branches that actually cost something.
 */
async function seedLearners(db: Db, groupId: ObjectId, courseIds: ObjectId[]): Promise<void> {
  const users: any[] = [];
  const members: any[] = [];
  const progress: any[] = [];
  const now = new Date();

  const metas = await db
    .collection('v2coursemetas')
    .find({ course: { $in: courseIds } })
    .toArray();
  const itemsByCourse = new Map(metas.map((meta) => [String(meta.course), meta.structure]));

  for (let index = 0; index < memberCount; index += 1) {
    const userId = new ObjectId();
    users.push({
      _id: userId,
      email: `perf-${index + 1}@${LEARNER_DOMAIN}`,
      userName: `perf_fixture_${index + 1}`,
      firstName: 'Perf',
      lastName: `Learner ${index + 1}`,
      status: 'active',
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    members.push({
      group: groupId,
      user: userId,
      role: 'learner',
      status: 'active',
      joinedAt: now,
      deletedAt: null,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // Two in three have opened something; the rest have never started, which
    // is the row the report exists to surface.
    if (index % 3 === 2) {
      continue;
    }

    for (const courseId of courseIds) {
      const structure = itemsByCourse.get(String(courseId)) ?? [];
      const completed = (index + Number(String(courseId).slice(-1), 16)) % (ITEMS_PER_COURSE + 1);

      progress.push({
        user: userId,
        course: courseId,
        status: completed >= ITEMS_PER_COURSE ? 'completed' : 'in_progress',
        progress: Math.round((completed / ITEMS_PER_COURSE) * 100),
        totalItems: ITEMS_PER_COURSE,
        completedItems: completed,
        completedAt: completed >= ITEMS_PER_COURSE ? now : null,
        lastAccessedAt: new Date(now.getTime() - index * 60_000),
        courseMetaVersionNumber: 1,
        items: structure.map((entry: any, itemIndex: number) => ({
          itemId: entry.itemRef,
          type: 'lesson',
          status: itemIndex < completed ? 'completed' : 'not_started',
          completedAt: itemIndex < completed ? now : null,
        })),
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  await db.collection('users').insertMany(users);
  await db.collection('groupmembers').insertMany(members);
  for (let start = 0; start < progress.length; start += 500) {
    await db.collection('usercourseprogresses').insertMany(progress.slice(start, start + 500));
  }

  console.log(`seeded ${users.length} learners and ${progress.length} progress rows`);
}

async function attachLeader(db: Db, groupId: ObjectId): Promise<void> {
  const leader = await db.collection('users').findOne({ email: leaderEmail });
  if (!leader) {
    console.warn(`no user ${leaderEmail}; the group has no leader and the report cannot be called`);
    return;
  }

  const now = new Date();
  await db.collection('groupmembers').updateOne(
    { group: groupId, user: leader._id },
    {
      $set: {
        group: groupId,
        user: leader._id,
        role: 'leader',
        status: 'active',
        deletedAt: null,
        expiresAt: null,
        joinedAt: now,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  console.log(`${leaderEmail} leads ${GROUP_NAME}`);
}

async function main(): Promise<void> {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  try {
    // Always clear first: resizing a roster in place would otherwise leave the
    // previous run's learners behind and quietly measure the wrong number.
    await removeFixture(db);
    if (remove) {
      return;
    }

    const groupId = new ObjectId();
    await db.collection('groups').insertOne({
      _id: groupId,
      name: GROUP_NAME,
      slug: GROUP_SLUG,
      description: 'Local performance fixture for the course-progress report.',
      type: 'class',
      status: 'active',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const courseIds = await seedCourses(db, groupId);
    await seedLearners(db, groupId, courseIds);
    await attachLeader(db, groupId);

    console.log(`group ${groupId} — ${memberCount} members x ${courseIds.length} courses`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
