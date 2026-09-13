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

    process.stdout.write(
      `${account.email.padEnd(24)} ${account.role.padEnd(14)} ${String(userId)}  memberships ${groups}  courses ${courses}\n`,
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
  const removed = await db.collection('users').deleteMany({ _id: { $in: ids } });
  process.stdout.write(
    `removed ${removed.deletedCount} accounts, ${members.deletedCount} memberships, ${notifications.deletedCount} notification preferences, ${enrolments.deletedCount} enrolments, ${progress.deletedCount} progress records\n`,
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
