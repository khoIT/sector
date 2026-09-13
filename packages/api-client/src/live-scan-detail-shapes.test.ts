import { describe, expect, it } from 'vitest';

import { createClient, type ApiClient } from './client';
import { getScanTypeItems } from './endpoints/scan-type';
import { getScanById } from './endpoints/scan';
import { getScanNotes } from './endpoints/scan-note';
import { getSharedScanDetail, getSharesForScan } from './endpoints/scan-share';
import { scanReviewResultSchema } from './schemas/scan-review-submit';

/**
 * Contract check for the scan DETAIL surface against the running legacy API.
 *
 * Opt-in and token-driven rather than password-driven: /api/login is rate
 * limited to 20 requests per 15 minutes per IP and is shared with every other
 * suite and every manual sign-in, so this one reuses a session instead of
 * spending the budget.
 *
 *   SECTOR_LIVE_API=1 \
 *   SECTOR_REVIEWER_TOKEN=… SECTOR_LEARNER_TOKEN=… \
 *   SECTOR_SHARE_ID=… \
 *   pnpm --filter @sector/api-client exec vitest run src/live-scan-detail-shapes.test.ts
 *
 * A `parse` ApiError here means the wire disagrees with a schema — which would
 * blank the detail page at runtime rather than fail in CI.
 */
const LIVE = process.env.SECTOR_LIVE_API === '1';
const BASE = process.env.SECTOR_API_URL ?? 'http://localhost:5001';
const REVIEWER_TOKEN = process.env.SECTOR_REVIEWER_TOKEN ?? '';
const LEARNER_TOKEN = process.env.SECTOR_LEARNER_TOKEN ?? '';
const SHARE_ID = process.env.SECTOR_SHARE_ID ?? '';
const REVIEWER_ID = process.env.SECTOR_REVIEWER_ID ?? '';

function clientFor(token: string): ApiClient {
  return createClient({ baseUrl: BASE, getToken: () => token });
}

describe.skipIf(!LIVE || !REVIEWER_TOKEN)('live scan-detail shapes', () => {
  it('parses a reviewed scan detail, its notes and its scan-type definitions', async () => {
    const client = clientFor(REVIEWER_TOKEN);

    const page = await client.get<{ items: { id: string }[] }>('/api/scan/reviewed/list', {
      query: { page: 1, limit: 5 },
    });
    const first = page.items[0];
    expect(first).toBeDefined();

    const scan = await getScanById(client, 'reviewed', first!.id);
    expect(scan.id).toBe(first!.id);

    const notes = await getScanNotes(client, scan.id);
    expect(Array.isArray(notes.items)).toBe(true);
    expect(notes.totalItems).toBe(notes.items.length);

    const definitions = await getScanTypeItems(client, scan.scanType.id);
    expect(Array.isArray(definitions.items)).toBe(true);
    expect(Array.isArray(definitions.forms)).toBe(true);
  });

  it('parses a pending scan detail for the review panel', async () => {
    const client = clientFor(REVIEWER_TOKEN);

    const page = await client.get<{ items: { id: string }[] }>('/api/scan/pending/list', {
      query: { page: 1, limit: 5 },
    });
    const first = page.items[0];
    expect(first).toBeDefined();

    const scan = await getScanById(client, 'pending', first!.id);
    expect(scan.status).toBe('submitted');
  });

  /**
   * The drift the submit schema exists for: the POST response returns `scan` as
   * a populated object while every read route returns it as an id string.
   * Asserted on the shape rather than by submitting, because submitting is not
   * idempotent — it reviews a real scan.
   */
  it('normalises a populated `scan` object on a review result to the scan id', () => {
    const parsed = scanReviewResultSchema.parse({
      id: 'review-1',
      scan: { title: 'Vascular-SEP10-00009', id: 'scan-1' },
      user: { id: 'u1', userName: 'sv_reviewer', email: 'reviewer@scanvault.test' },
      competencyMeasure: 'achieved',
      overAllFeed: 'ok',
      customReviews: [{ question: 'Ejection Fraction', answer: 'normal', id: 'x', _id: 'x' }],
      createdAt: '2026-09-11T15:54:11.487Z',
      updatedAt: '2026-09-11T15:54:11.487Z',
    });

    expect(parsed.scan).toBe('scan-1');
    expect(scanReviewResultSchema.parse({ ...reviewWithStringScan() }).scan).toBe('scan-2');
  });

  it.skipIf(!REVIEWER_ID)('parses the sharer-side share list', async () => {
    const client = clientFor(REVIEWER_TOKEN);
    const page = await client.get<{ items: { scan: unknown }[] }>('/api/shared-scans/all', {
      query: { sharedBy: REVIEWER_ID, page: 1, limit: 1 },
    });
    const scanId =
      typeof page.items[0]?.scan === 'string'
        ? (page.items[0]!.scan as string)
        : ((page.items[0]?.scan as { id: string } | undefined)?.id ?? '');

    if (!scanId) return;
    const shares = await getSharesForScan(client, { scanId, sharedBy: REVIEWER_ID });
    expect(shares.length).toBeGreaterThan(0);
  });

  it.skipIf(!LEARNER_TOKEN || !SHARE_ID)('parses a shared scan detail', async () => {
    const detail = await getSharedScanDetail(clientFor(LEARNER_TOKEN), SHARE_ID);
    expect(detail.scan.id).toBeTruthy();
    expect(['unopened', 'opened']).toContain(detail.status);
  });
});

function reviewWithStringScan() {
  return {
    id: 'review-2',
    scan: 'scan-2',
    user: { id: 'u1', userName: 'sv_reviewer', email: 'reviewer@scanvault.test' },
    createdAt: '2026-09-11T15:54:11.487Z',
    updatedAt: '2026-09-11T15:54:11.487Z',
  };
}
