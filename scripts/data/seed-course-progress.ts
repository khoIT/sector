import { readFileSync } from 'node:fs';

import { MongoClient, ObjectId, type Db } from 'mongodb';

import { mintDevSession } from '../../packages/api-client/src/fidelity/dev-session';
import { assertLocalMirrorUri } from '../../packages/api-client/src/fidelity/mirror';

/**
 * Give the seeded learner real course progress, by driving the API.
 *
 *   pnpm tsx scripts/data/seed-course-progress.ts [--api http://localhost:5002]
 *       [--db gusi_prod_mirror] [--email learner@sector.test] [--courses 6]
 *
 * The dumps carry no `usercourseprogresses` at all — the collection is empty —
 * so every course surface can only ever be seen in its not-started state, and
 * the read seam's progress mapping, resume pointer and completion arithmetic
 * have nothing real to be checked against.
 *
 * The progress is created through `POST /courses/:courseId/track`, NOT by
 * writing documents: the shape of a progress record is the API's business,
 * it changes with the version-pinning and recalculation logic, and a
 * hand-written one would pass tests the real thing would fail. The cost is
 * that this needs the mirror API running and a session, which the local JWT
 * secret mints without spending the auth rate limit.
 *
 * Courses are left in a spread of states — untouched, one item in, part way,
 * finished — because that spread is the thing under test: a My Courses list
 * where every row says the same thing proves nothing.
 *
 * A quiz does not complete from the ordinary track call: the API completes it
 * only once every question has an answer, through the quiz track route. So
 * the courses meant to finish get their quizzes answered, question by
 * question, with the correct answer read from the question document. Without
 * that, tracking every item in a course still leaves it at half, and the one
 * thing this phase exists to prove — that a course can reach 100% — cannot be
 * seen at all.
 */

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const apiUrl = arg('--api', 'http://localhost:5002');
const uri = arg('--uri', 'mongodb://localhost:27017/?directConnection=true');
const dbName = arg('--db', 'gusi_prod_mirror');
const email = arg('--email', 'learner@sector.test');
const courseCount = Number(arg('--courses', '6'));

assertLocalMirrorUri(uri);
if (!/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(apiUrl)) {
  throw new Error(`refusing API '${apiUrl}': it must be a local instance`);
}

/** The secret the local API instance was started with. Never committed. */
function localSecret(): string {
  const env = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
  const secret = /^SECTOR_MIRROR_JWT_SECRET=(.+)$/m.exec(env)?.[1]?.trim();
  if (!secret) throw new Error('SECTOR_MIRROR_JWT_SECRET is not in .env.local');
  return secret;
}

type OutlineItem = {
  id: string;
  kind: 'lesson' | 'topic' | 'quiz';
  title: string;
  order: number;
  status: string;
  blockedReason: string | null;
  quiz: { questionCount: number } | null;
};

type StoredAnswer = { _id: ObjectId; correct?: boolean };
type StoredQuestion = { _id: ObjectId; answerType?: string; answers?: StoredAnswer[] };

type Outline = {
  items: OutlineItem[];
  totalItems: number;
  completedItems: number;
  progress: number;
  status: string;
  resume: { itemId: string; kind: string } | null;
};

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json()) as { data?: T; message?: string };
  if (!response.ok) throw new Error(`${path} → ${response.status} ${body.message ?? ''}`);
  return body.data as T;
}

/**
 * How far through each course to take the learner. One of each shape the
 * surfaces have to render, and the fractions are of the COMPLETABLE items so
 * the last course really does reach 100%.
 */
const PLAN: ReadonlyArray<{ fraction: number; label: string }> = [
  { fraction: 0, label: 'not started' },
  { fraction: 0.04, label: 'just opened' },
  { fraction: 0.3, label: 'part way' },
  { fraction: 0.6, label: 'more than half' },
  { fraction: 0.95, label: 'nearly done' },
  { fraction: 1, label: 'finished' },
];

/**
 * Answer every question of one quiz, correctly.
 *
 * The route takes one question per call and completes the quiz when the
 * answered count reaches `quiz.questions.length` — which counts non-deleted
 * questions whatever their publish status, so the answers come from the quiz
 * document rather than from a published-only filter.
 */
async function answerQuiz(
  db: Db,
  token: string,
  courseId: string,
  quizId: string,
): Promise<{ answered: number; failed: number }> {
  const quiz = await db.collection('v2quizzes').findOne({ _id: new ObjectId(quizId) });
  const questionIds = Array.isArray(quiz?.questions) ? (quiz.questions as ObjectId[]) : [];
  if (questionIds.length === 0) return { answered: 0, failed: 0 };

  const questions = (await db
    .collection('v2questions')
    .find({ _id: { $in: questionIds }, deletedAt: null })
    .toArray()) as StoredQuestion[];

  const startedAt = new Date(Date.now() - 5 * 60_000).toISOString();
  let answered = 0;
  let failed = 0;

  for (const question of questions) {
    const correct = (question.answers ?? []).filter((answer) => answer.correct);
    if (correct.length === 0) {
      failed += 1;
      continue;
    }
    // The route normalises a bare string and an array alike; send what the
    // question's own type implies so the stored attempt looks like a real one.
    const answerId =
      question.answerType === 'multiple'
        ? correct.map((answer) => String(answer._id))
        : String(correct[0]!._id);

    try {
      await api(`/api/v2/learners/courses/${courseId}/quizzes/${quizId}/track`, token, {
        method: 'POST',
        body: JSON.stringify({
          dateTimeStarted: startedAt,
          dateTimeFinished: new Date().toISOString(),
          questionId: String(question._id),
          answerId,
        }),
      });
      answered += 1;
    } catch {
      failed += 1;
    }
  }

  return { answered, failed };
}

async function main(): Promise<void> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000 });
  await client.connect();

  try {
    const db: Db = client.db(dbName);
    const user = await db.collection('users').findOne({ email });
    if (!user) throw new Error(`${email} is not in ${dbName} — run seed-test-accounts.ts first`);
    const token = mintDevSession((user._id as ObjectId).toHexString(), localSecret());

    const enrolments = await db
      .collection('usercourses')
      .find({ user: user._id, deletedAt: null })
      .sort({ _id: 1 })
      .toArray();
    if (enrolments.length === 0) throw new Error('the learner has no enrolments to work through');

    // Courses with enough items to show a partial state, largest first, so
    // "30% complete" is a real fraction rather than one item out of three.
    const candidates: Array<{ courseId: string; outline: Outline }> = [];
    for (const enrolment of enrolments) {
      if (candidates.length >= courseCount * 3) break;
      const courseId = String(enrolment.course);
      try {
        const outline = await api<Outline>(`/api/v2/learners/courses/${courseId}/outline`, token);
        if (outline.items.length >= 6) candidates.push({ courseId, outline });
      } catch {
        // A course whose structure or version cannot resolve is not a fixture.
        continue;
      }
    }
    candidates.sort((a, b) => b.outline.items.length - a.outline.items.length);

    const chosen = candidates.slice(0, Math.min(courseCount, PLAN.length));
    process.stdout.write(`${email} in ${dbName}: shaping ${chosen.length} courses\n\n`);

    for (const [index, { courseId, outline }] of chosen.entries()) {
      const step = PLAN[index] ?? PLAN[PLAN.length - 1]!;
      // A blocked item cannot be completed, so asking the API to complete it
      // would be asking for a 400 and would never move the count.
      const completable = outline.items.filter((item) => !item.blockedReason);
      const target = Math.round(completable.length * step.fraction);

      let tracked = 0;
      let quizzesAnswered = 0;
      for (const item of completable.slice(0, target)) {
        try {
          await api(`/api/v2/learners/courses/${courseId}/track`, token, {
            method: 'POST',
            body: JSON.stringify({
              contentType: item.kind,
              contentId: item.id,
              timeSpent: 60 + ((item.order * 37) % 240),
            }),
          });
          tracked += 1;
        } catch (error) {
          process.stdout.write(`  ! ${item.kind} ${item.id}: ${(error as Error).message}\n`);
          continue;
        }

        // Tracking a quiz records that it was opened. Completing it means
        // answering it.
        if (item.kind === 'quiz' && (item.quiz?.questionCount ?? 0) > 0) {
          const { answered } = await answerQuiz(db, token, courseId, item.id);
          if (answered > 0) quizzesAnswered += 1;
        }
      }

      const after = await api<Outline>(`/api/v2/learners/courses/${courseId}/outline`, token);
      process.stdout.write(
        `${courseId}  ${step.label.padEnd(16)} tracked ${String(tracked).padStart(3)}  ` +
          `quizzes ${String(quizzesAnswered).padStart(2)}  ` +
          `→ ${after.completedItems}/${after.totalItems} (${Math.round(after.progress)}%) ${after.status}` +
          `  resume ${after.resume ? `${after.resume.kind} ${after.resume.itemId}` : 'none'}\n`,
      );
    }

    const progressRows = await db
      .collection('usercourseprogresses')
      .countDocuments({ user: user._id });
    const activityRows = await db
      .collection('usercourseactivities')
      .countDocuments({ user: user._id });
    process.stdout.write(`\nprogress records ${progressRows}, activity records ${activityRows}\n`);
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
