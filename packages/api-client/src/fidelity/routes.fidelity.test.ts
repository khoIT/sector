import type { ObjectId } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ZodTypeAny } from 'zod';

import { createClient, type ApiClient } from '../client';
import { paginatedSchema } from '../envelope';
import { SCAN_LIST_VIEWS } from '../query-keys';
import { userGroupSchema } from '../schemas/common';
import { learnerCoursesPageSchema } from '../schemas/course';
import { courseOutlineSchema } from '../schemas/course-outline';
import { scanNoteListSchema, scanSchema, scanUserSchema } from '../schemas/scan';
import { sharedScanListItemSchema } from '../schemas/shared-scan-list';
import { scanDetailPath, scanListPath } from '../endpoints/scan';
import { mintDevSession } from './dev-session';
import { openMirror, type Mirror } from './mirror';
import { formatReplayReport } from './report';
import { issueSignature, type ReplayResult, type ShapeFailure } from './replay';

/**
 * The route replay: the same schemas, but through the RUNNING mirror API
 * rather than through an emulation of it.
 *
 * The collection replay proves every document; this proves the API's own
 * mapping of them, including what no dump can hold — presigned media, the
 * groupuserscans join, populated logs — for every page of every list view a
 * role can open. It needs:
 *
 *   SECTOR_MIRROR_API_URL     the mirror API (default http://localhost:5002)
 *   SECTOR_MIRROR_JWT_SECRET  the secret that instance was started with
 *
 * and skips, loudly, without them. Sessions are minted (see dev-session.ts),
 * so it never touches the auth routes' rate limit. Details are sampled — one
 * in every twenty-five rows of each list — because 30,000 detail requests are
 * a load test, not a fidelity check.
 */

const API_URL = process.env.SECTOR_MIRROR_API_URL ?? 'http://localhost:5002';
const SECRET = process.env.SECTOR_MIRROR_JWT_SECRET ?? '';
const DETAIL_SAMPLE_EVERY = 25;
/** One outline in five for the courses a learner has never opened. */
const OUTLINE_SAMPLE_EVERY = 5;

/** The accounts the seed script creates, plus what each one is expected to reach. */
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
    `\nroute replay skipped: ${SECRET ? '' : 'SECTOR_MIRROR_JWT_SECRET is not set; '}${API_URL} ${(await reachable()) ? 'is up' : 'is not answering'}\n`,
  );
}

type Tally = { total: number; parsed: number; shapes: Map<string, ShapeFailure> };

function tally(): Tally {
  return { total: 0, parsed: 0, shapes: new Map() };
}

function record(into: Tally, schema: ZodTypeAny, value: unknown, id: string): void {
  into.total += 1;
  const result = schema.safeParse(value);
  if (result.success) {
    into.parsed += 1;
    return;
  }
  const signature = issueSignature(result.error.issues);
  const existing = into.shapes.get(signature);
  if (existing) existing.count += 1;
  else
    into.shapes.set(signature, {
      signature,
      count: 1,
      sampleId: id,
      sampleIssues: result.error.issues,
    });
}

function finish(name: string, into: Tally, started: number): ReplayResult {
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

describe.skipIf(!enabled)('route replay against the mirror API', () => {
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
    it.each(SCAN_LIST_VIEWS)(
      'walks every page of %s and a sample of its details',
      async (view) => {
        const client = clients.get(email)!;
        const started = Date.now();
        const rows = tally();
        const details = tally();
        const pageSchema = paginatedSchema(scanSchema);

        let page = 1;
        let totalPages = 1;
        let seen = 0;
        let forbidden = false;
        do {
          let raw: unknown;
          try {
            raw = await client.get(scanListPath(view), { query: { page, limit: 100 } });
          } catch (error) {
            // A role that may not open this view gets 403, which is the correct
            // answer, not a shape.
            if ((error as { statusCode?: number }).statusCode === 403) {
              forbidden = true;
              break;
            }
            throw error;
          }
          const envelope = pageSchema.pick({ page: true, totalPages: true }).safeParse(raw);
          if (!envelope.success) throw new Error(`${view} page ${page}: envelope did not parse`);
          totalPages = envelope.data.totalPages;

          const items = (raw as { items?: unknown[] }).items ?? [];
          for (const item of items) {
            const id = String((item as { id?: unknown }).id ?? '?');
            record(rows, scanSchema, item, id);
            if (seen % DETAIL_SAMPLE_EVERY === 0 && id !== '?') {
              const detail = await client.get(scanDetailPath(view, id));
              record(details, scanSchema, detail, id);
            }
            seen += 1;
          }
          page += 1;
        } while (page <= totalPages);

        const listResult = finish(
          `${email} ${view} list${forbidden ? ' (403)' : ''}`,
          rows,
          started,
        );
        const detailResult = finish(`${email} ${view} detail sample`, details, started);
        expect(listResult.shapes.map((shape) => `${shape.count}× ${shape.signature}`)).toEqual([]);
        expect(detailResult.shapes.map((shape) => `${shape.count}× ${shape.signature}`)).toEqual(
          [],
        );
      },
      20 * 60_000,
    );
  });

  /**
   * My Courses and the outline, for every account that has an enrolment.
   *
   * This is the only check that sees the two course routes as a learner
   * receives them. Both are assembled per caller — the list merges a personal
   * branch with a group one and splits the expired rows off; the outline
   * resolves a course-meta structure against the caller's own progress — so
   * neither has a collection a document replay could walk.
   *
   * Every page of the list is parsed, never a sample: the expired array and
   * the group-assigned rows are exactly what a first page of personal
   * enrolments hides. The outlines are sampled (see below), because they are
   * the heaviest read the API has and this gate has to be runnable beside a
   * developer's own session rather than instead of it.
   */
  it.each(ACCOUNTS)(
    'parses every My Courses page and every outline for %s',
    async (email) => {
      const client = clients.get(email)!;
      const started = Date.now();
      const pages = tally();
      const outlines = tally();

      const courseIds = new Set<string>();
      const expiredCourseIds = new Set<string>();
      let page = 1;
      let totalPages = 1;
      let ordinary = 0;
      do {
        const raw = await client.get('/api/v2/learners/courses', {
          query: { page, limit: 100 },
        });
        record(pages, learnerCoursesPageSchema, raw, `page ${page}`);
        const parsed = learnerCoursesPageSchema.safeParse(raw);
        if (!parsed.success) break;
        totalPages = parsed.data.totalPages;
        for (const row of [...parsed.data.items, ...parsed.data.expired]) {
          // Resolving an outline is the most expensive read the API serves —
          // a structure walk plus every lesson, topic, quiz and question in
          // the course — so this asks for the ones that can differ and a
          // sample of the rest, the same trade the scan detail sample makes
          // above. A row the learner has never opened has no progress
          // document, and every shape that broke this client lives in one:
          // the failed quiz status, the absent version pin, the counters that
          // predate their own migration. Group and expired rows are always
          // included because their row shape differs too.
          const carriesProgress =
            row.progress.status !== 'not_started' ||
            row.assignmentType === 'group' ||
            row.isExpired;
          if (carriesProgress || ordinary % OUTLINE_SAMPLE_EVERY === 0) {
            courseIds.add(row.course.id);
          }
          if (row.isExpired) expiredCourseIds.add(row.course.id);
          if (!carriesProgress) ordinary += 1;
        }
        page += 1;
      } while (page <= totalPages);

      let refused = 0;
      for (const courseId of courseIds) {
        try {
          record(
            outlines,
            courseOutlineSchema,
            await client.get(`/api/v2/learners/courses/${courseId}/outline`),
            courseId,
          );
        } catch (error) {
          // An expired enrolment still appears in the list — in the `expired`
          // array, which the UI renders as text rather than as a link — but
          // the outline route refuses it with "Your account or group is not
          // enrolled to this course". That is the access rule answering, not
          // a shape, and it is asserted here rather than swallowed: a 404 for
          // a row the list did NOT mark expired is a real failure.
          const notFound = (error as { isNotFound?: boolean }).isNotFound === true;
          if (notFound && expiredCourseIds.has(courseId)) {
            refused += 1;
            continue;
          }
          throw error;
        }
      }

      const pageResult = finish(`${email} my courses pages`, pages, started);
      const outlineResult = finish(`${email} course outlines`, outlines, started);
      outlineResult.skipped = refused;
      expect(pageResult.shapes.map((shape) => `${shape.count}× ${shape.signature}`)).toEqual([]);
      expect(outlineResult.shapes.map((shape) => `${shape.count}× ${shape.signature}`)).toEqual([]);
    },
    20 * 60_000,
  );

  it(
    'parses the filter sources, the shared list and a notes thread for a reviewer',
    async () => {
      const client = clients.get('reviewer@sector.test')!;
      const started = Date.now();

      const groups = tally();
      for (const group of (await client.get('/api/scan/user-groups')) as unknown[]) {
        record(groups, userGroupSchema, group, String((group as { id?: unknown }).id));
      }
      finish('reviewer user-groups', groups, started);

      const users = tally();
      for (const type of ['pending', 'reviewed'] as const) {
        for (const user of (await client.get('/api/scan/users', {
          query: { type },
        })) as unknown[]) {
          record(users, scanUserSchema, user, String((user as { id?: unknown }).id));
        }
      }
      finish('reviewer scan users', users, started);

      const shares = tally();
      const shared = (await client.get('/api/shared-scans', {
        query: { page: 1, limit: 100 },
      })) as {
        items?: unknown[];
      };
      for (const item of shared.items ?? []) {
        record(shares, sharedScanListItemSchema, item, String((item as { id?: unknown }).id));
      }
      finish('reviewer shared-scans list', shares, started);

      const notes = tally();
      const queue = (await client.get(scanListPath('pending'), {
        query: { page: 1, limit: 50 },
      })) as {
        items?: Array<{ id: string; notes?: unknown[] }>;
      };
      const withNotes = (queue.items ?? []).find((scan) => (scan.notes?.length ?? 0) > 0);
      if (withNotes) {
        record(
          notes,
          scanNoteListSchema,
          await client.get(`/api/scan/${withNotes.id}/notes`),
          withNotes.id,
        );
      }
      finish('reviewer notes thread', notes, started);

      for (const result of results.slice(-4)) {
        expect(result.shapes.map((shape) => `${shape.count}× ${shape.signature}`)).toEqual([]);
      }
    },
    5 * 60_000,
  );
});
