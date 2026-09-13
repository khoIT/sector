import type { ObjectId } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ZodTypeAny } from 'zod';

import { createClient, type ApiClient } from '../client';
import { getAllGroups, getLedGroups } from '../endpoints/group';
import { getLearnerCourses } from '../endpoints/course';
import {
  getDashboardCourseCompletionTimeline,
  getDashboardCourseProgress,
  getDashboardTopCourseProgress,
} from '../endpoints/dashboard-course-charts';
import { getDashboardGroupCharts } from '../endpoints/dashboard-group-charts';
import {
  getDashboardQBankStats,
  getDashboardQuizProgress,
  getDashboardTopicProgress,
} from '../endpoints/dashboard-learning-progress';
import { getDashboardScanProgress } from '../endpoints/dashboard-scan-progress';
import {
  courseCompletionTimelineSchema,
  courseProgressChartSchema,
  dashboardGroupChartsSchema,
  qbankStatsSchema,
  quizProgressSchema,
  scanProgressByUserSchema,
  topCourseProgressSchema,
  topicProgressSchema,
} from '../schemas/dashboard';
import { mintDevSession } from './dev-session';
import { openMirror, type Mirror } from './mirror';
import { formatReplayReport } from './report';
import { issueSignature, type ReplayResult, type ShapeFailure } from './replay';

/**
 * The home screen's route replay: the eight `/api/dashboard/*` endpoints,
 * proved against the RUNNING mirror API for all four seeded roles.
 *
 * None of these responses is one stored document — each is assembled per
 * request across usercourseprogresses, scans, v2quizzes/qbankprogresses and
 * groupmembers (see the manifest's NOT_REPLAYED reasons) — so this file, not
 * a `REPLAY_ENTRIES` projection, is where they get proved. Needs the same two
 * variables `fidelity/routes.fidelity.test.ts` does:
 *
 *   SECTOR_MIRROR_API_URL     the mirror API (default http://localhost:5002)
 *   SECTOR_MIRROR_JWT_SECRET  the secret that instance was started with
 *
 * and skips, loudly, without them.
 */

const API_URL = process.env.SECTOR_MIRROR_API_URL ?? 'http://localhost:5002';
const SECRET = process.env.SECTOR_MIRROR_JWT_SECRET ?? '';

const ACCOUNTS = [
  'learner@sector.test',
  'leader@sector.test',
  'reviewer@sector.test',
  'admin@sector.test',
] as const;

let mirror: Mirror;
const clients = new Map<string, ApiClient>();
const results: ReplayResult[] = [];

async function reachable(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/scan-type`, { signal: AbortSignal.timeout(3000) });
    return response.status > 0;
  } catch {
    return false;
  }
}

const enabled = Boolean(SECRET) && (await reachable());
if (!enabled) {
  process.stdout.write(
    `\ndashboard route replay skipped: ${SECRET ? '' : 'SECTOR_MIRROR_JWT_SECRET is not set; '}${API_URL} ${(await reachable()) ? 'is up' : 'is not answering'}\n`,
  );
}

function tally() {
  return { total: 0, parsed: 0, shapes: new Map<string, ShapeFailure>() };
}

function record(
  into: ReturnType<typeof tally>,
  schema: ZodTypeAny,
  value: unknown,
  id: string,
): void {
  into.total += 1;
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    into.parsed += 1;
    return;
  }
  const signature = issueSignature(parsed.error.issues);
  const existing = into.shapes.get(signature);
  if (existing) existing.count += 1;
  else
    into.shapes.set(signature, {
      signature,
      count: 1,
      sampleId: id,
      sampleIssues: parsed.error.issues,
    });
}

function finish(name: string, into: ReturnType<typeof tally>, started: number): ReplayResult {
  const result: ReplayResult = {
    name,
    collection: name,
    total: into.total,
    parsed: into.parsed,
    skipped: 0,
    shapes: [...into.shapes.values()].sort((a, b) => b.count - a.count),
    durationMs: Date.now() - started,
  };
  results.push(result);
  return result;
}

function expectClean(result: ReplayResult): void {
  expect(result.shapes.map((shape) => `${shape.count}× ${shape.signature}`)).toEqual([]);
}

describe.skipIf(!enabled)('dashboard route replay against the mirror API', () => {
  beforeAll(async () => {
    mirror = await openMirror();
    for (const email of ACCOUNTS) {
      const user = await mirror.db.collection('users').findOne({ email });
      if (!user)
        throw new Error(`${email} is not in the mirror — run scripts/data/seed-test-accounts.ts`);
      const token = mintDevSession((user._id as ObjectId).toHexString(), SECRET);
      clients.set(email, createClient({ baseUrl: API_URL, getToken: () => token }));
    }
  }, 60_000);

  afterAll(async () => {
    process.stdout.write(formatReplayReport(results));
    await mirror?.close();
  });

  describe.each(ACCOUNTS)('%s', (email) => {
    it(
      'my learning: top courses, one course progress, its timeline, scans, qbank/topic/quiz',
      async () => {
        const client = clients.get(email)!;
        const started = Date.now();

        const top = tally();
        const topCourses = await getDashboardTopCourseProgress(client, { limit: 10 });
        record(top, topCourseProgressSchema, topCourses, email);
        expectClean(finish(`${email} top-course-progress`, top, started));

        // A course this account actually has progress on, if any — My
        // Courses is the one route every role can call for itself.
        const courses = await getLearnerCourses(client, { limit: 1 });
        const courseId = courses.items[0]?.course.id;

        if (courseId) {
          const progress = tally();
          record(
            progress,
            courseProgressChartSchema,
            await getDashboardCourseProgress(client, { courseId }),
            courseId,
          );
          expectClean(finish(`${email} course-progress-chart`, progress, started));

          const timeline = tally();
          record(
            timeline,
            courseCompletionTimelineSchema,
            await getDashboardCourseCompletionTimeline(client, { courseId }),
            courseId,
          );
          expectClean(finish(`${email} course-completion-timeline`, timeline, started));
        }

        const scans = tally();
        record(scans, scanProgressByUserSchema, await getDashboardScanProgress(client), email);
        expectClean(finish(`${email} scan-progress-by-user`, scans, started));

        const qbank = tally();
        record(qbank, qbankStatsSchema, await getDashboardQBankStats(client), email);
        expectClean(finish(`${email} qbank-stats`, qbank, started));

        const topics = tally();
        record(topics, topicProgressSchema, await getDashboardTopicProgress(client), email);
        expectClean(finish(`${email} topic-progress-by-user`, topics, started));

        const quizzes = tally();
        record(quizzes, quizProgressSchema, await getDashboardQuizProgress(client), email);
        expectClean(finish(`${email} quiz-progress-by-user`, quizzes, started));
      },
      5 * 60_000,
    );

    it(
      'group snapshot: charts for a led (or, for admin, any) group',
      async () => {
        const client = clients.get(email)!;
        const started = Date.now();

        const led = await getLedGroups(client, { limit: 1 });
        const groupId = led.items[0]?.id ?? (await getAllGroups(client, { limit: 1 })).items[0]?.id;
        if (!groupId) {
          // learner@sector.test leads nothing and is not full-access — there
          // is no group snapshot for this role, which is the correct answer,
          // not a shape to prove.
          return;
        }

        const charts = tally();
        record(
          charts,
          dashboardGroupChartsSchema,
          await getDashboardGroupCharts(client, { groupId }),
          groupId,
        );
        expectClean(finish(`${email} charts (group ${groupId})`, charts, started));

        const groupScans = tally();
        record(
          groupScans,
          scanProgressByUserSchema,
          await getDashboardScanProgress(client, { groupId }),
          groupId,
        );
        expectClean(finish(`${email} scan-progress-by-user (group)`, groupScans, started));
      },
      5 * 60_000,
    );
  });
});
