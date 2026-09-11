import { beforeAll, describe, expect, it } from 'vitest';

import { createClient, type ApiClient } from './client';
import { getCurrentUser, login } from './endpoints/auth';
import { getScanById, getScanList, getScanUserGroups, getScanUsers } from './endpoints/scan';
import { isApiError } from './errors';
import { SCAN_LIST_VIEWS } from './query-keys';
import type { AuthSession } from './schemas/auth';
import { scanNoteListSchema } from './schemas/scan';

/**
 * Contract check against the RUNNING legacy API. Opt-in, because it needs the
 * API on :5001 and a seeded local gusi_dev:
 *
 *   SCANVAULT_DEMO_PASSWORD='…' pnpm --filter @scanvault/api-client test:live
 *
 * Every schema in this package was derived from real responses rather than from
 * the legacy client's Zod objects, which were never `.parse()`d and had drifted.
 * Run this after adding or widening a schema: a `parse` ApiError here means the
 * wire disagrees with the type, and shipping it would blank a page at runtime
 * instead of failing in CI.
 *
 * Auth routes are rate limited to 20 requests per 15 minutes PER IP, and both
 * /api/login and /api/me count. This suite signs in exactly once per account
 * (4 logins + 1 refresh per run) and shares the sessions, so it can be run
 * several times in a sitting. Manual browser testing eats the same budget.
 */

const LIVE = process.env.SCANVAULT_LIVE_API === '1';
const BASE = process.env.SCANVAULT_API_URL ?? 'http://localhost:5001';
const PASSWORD = process.env.SCANVAULT_DEMO_PASSWORD ?? '';

const ACCOUNTS = [
  'learner@scanvault.test',
  'reviewer@scanvault.test',
  'reviewer-solo@scanvault.test',
  'leader@scanvault.test',
];

const sessions = new Map<string, AuthSession>();
const clients = new Map<string, ApiClient>();

describe.skipIf(!LIVE || !PASSWORD)('live API shapes', () => {
  beforeAll(async () => {
    const anon = createClient({ baseUrl: BASE });

    for (const userEmail of ACCOUNTS) {
      try {
        const session = await login(anon, { userEmail, password: PASSWORD });
        sessions.set(userEmail, session);
        clients.set(
          userEmail,
          createClient({ baseUrl: BASE, getToken: () => session.token }),
        );
      } catch (error) {
        if (isApiError(error) && error.statusCode === 429) {
          throw new Error(
            'Auth rate limit hit (20 requests / 15 min per IP, shared by /api/login and ' +
              '/api/me). Wait for the window to roll over and re-run.',
          );
        }
        throw error;
      }
    }
  }, 120_000);

  it('parses every scan list and detail, or fails the permission check cleanly', async () => {
    for (const userEmail of ACCOUNTS) {
      const session = sessions.get(userEmail)!;
      const authed = clients.get(userEmail)!;
      expect(session.user.role.permissions.length).toBeGreaterThan(0);

      for (const view of SCAN_LIST_VIEWS) {
        try {
          const page = await getScanList(authed, view, {
            pagination: { pageIndex: 0, pageSize: 50 },
          });

          if (page.items[0]) {
            const detail = await getScanById(authed, view, page.items[0].id);
            expect(detail.id).toBe(page.items[0].id);
          }
        } catch (error) {
          // A permission denial is expected for some account/view pairs. A
          // schema mismatch never is.
          if (isApiError(error) && error.kind === 'parse') throw error;
          if (!isApiError(error) || error.statusCode !== 403) throw error;
        }
      }
    }
  }, 180_000);

  it('parses the filter sources and the notes route', async () => {
    const authed = clients.get('reviewer@scanvault.test')!;

    await getScanUserGroups(authed);
    await getScanUsers(authed, 'pending');

    const page = await getScanList(authed, 'pending', {
      pagination: { pageIndex: 0, pageSize: 50 },
    });
    const withNotes = page.items.find((scan) => scan.notes.length > 0);

    if (withNotes) {
      const notes = await authed.get(`/api/scan/${withNotes.id}/notes`, {
        schema: scanNoteListSchema,
      });
      expect(notes.items.length).toBe(notes.totalItems);
    }
  }, 120_000);

  it('parses a session restore', async () => {
    const session = sessions.get('leader@scanvault.test')!;
    expect(session.refreshToken).toBeTruthy();

    // GET /api/me rotates the refresh token, so this consumes the one obtained
    // in beforeAll. It runs last and on the account no other test reuses.
    const restored = await getCurrentUser(
      createClient({ baseUrl: BASE }),
      session.refreshToken as string,
    );
    expect(restored.user.id).toBe(session.user.id);
  }, 60_000);
});
