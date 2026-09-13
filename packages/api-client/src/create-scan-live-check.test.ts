import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createClient, type ApiClient } from './client';
import { login } from './endpoints/auth';
import {
  getFindingDefinitions,
  getScanTypes,
  getUserOrganizations,
} from './endpoints/create-scan-lookups';
import { getScanUserGroups } from './endpoints/scan';
import { getScanReviewCredits } from './endpoints/scan-review-credits';
import { uploadPresign } from './endpoints/scan-upload';
import { createScan, updateFileDetailsStatus, updateScanFileStatus } from './endpoints/scan-write';
import { isApiError } from './errors';
import type { AuthSession } from './schemas/auth';
import { findingDefinitionSchema } from './schemas/create-scan-lookups';
import { scanSchema } from './schemas/scan';
import { buildScanFilekey, putToPresignedUrl } from './upload-keys';

/**
 * Contract check for the create-scan surface against the RUNNING legacy API.
 *
 *   SECTOR_LIVE_API=1 SECTOR_DEMO_PASSWORD='…' \
 *     pnpm --filter @sector/api-client exec vitest run src/create-scan-live-check.test.ts
 *
 * Read-only by default. Setting SECTOR_LIVE_WRITE=1 additionally runs the
 * whole background-first flow end to end — presign against a client-minted
 * draft id, PUT bytes, create the scan around the resulting key, confirm the
 * file — because that ordering is the central claim of the wizard and the only
 * way to know it holds is to do it.
 *
 * The write path targets the LOCAL database and the staging bucket. Never
 * point it at production.
 *
 * Auth is rate limited to 20 requests / 15 min per IP across /api/login and
 * /api/me, so this signs in once.
 */

const LIVE = process.env.SECTOR_LIVE_API === '1';
const WRITE = process.env.SECTOR_LIVE_WRITE === '1';
const BASE = process.env.SECTOR_API_URL ?? 'http://localhost:5001';
const PASSWORD = process.env.SECTOR_DEMO_PASSWORD ?? '';
/**
 * A bearer token from an earlier sign-in. The 20-per-15-minutes auth limit is
 * per IP and shared with every other suite and browser tab on this machine, so
 * reusing a token is the difference between running this and waiting.
 */
const TOKEN = process.env.SECTOR_DEMO_TOKEN ?? '';

/** A 1x1 PNG. Small enough to PUT in a test, real enough to pass a sniff. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function mintDraftId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe.skipIf(!LIVE || !(PASSWORD || TOKEN))('create-scan live shapes', () => {
  let userId: string;
  let client: ApiClient;

  beforeAll(async () => {
    if (TOKEN) {
      client = createClient({ baseUrl: BASE, getToken: () => TOKEN });
      // /api/me is a refresh-token exchange, not a "current user" route, so the
      // id comes from a route that does carry it.
      const scans = await client.get<{ items: Array<{ user: { id: string } }> }>(
        '/api/scan/list?limit=1',
      );
      userId = scans.items[0]?.user.id ?? '';
      return;
    }

    const anon = createClient({ baseUrl: BASE });
    let session: AuthSession;
    try {
      session = await login(anon, { userEmail: 'learner@scanvault.test', password: PASSWORD });
    } catch (error) {
      if (isApiError(error) && error.statusCode === 429) {
        throw new Error(
          'Auth rate limit hit (20 requests / 15 min per IP). Re-run with ' +
            'SECTOR_DEMO_TOKEN=<bearer> to reuse an existing session.',
        );
      }
      throw error;
    }
    userId = session.user.id;
    client = createClient({ baseUrl: BASE, getToken: () => session.token });
  }, 30_000);

  it('parses the scan-type picker source', async () => {
    const types = await getScanTypes(client);
    expect(types.length).toBeGreaterThan(0);
    // The list route sends no `key` and no `isActive` — the legacy schema
    // declared both required, which is why they are optional here.
    expect(types[0]?.name).toBeTruthy();
  }, 30_000);

  it('parses the findings definition of every scan type', async () => {
    const types = await getScanTypes(client);

    for (const type of types) {
      const definitions = await getFindingDefinitions(client, type.id);
      expect(Array.isArray(definitions.items)).toBe(true);
    }
  }, 60_000);

  it('covers the older findings shapes the per-type route no longer serves', async () => {
    // /api/scan-type/:id/items serves only the CURRENT version, which on this
    // database is all single-select plus one numeric input. The multi-selects
    // (dataType 'array') and the section headings (type null, level null) live
    // in the v2 definitions that /list/full still returns and that historical
    // scans still reference, so the schema and the controls have to handle
    // them. Parsing them here is what proves that, rather than asserting the
    // v5 route emits something it does not.
    const full = await client.get('/api/scan-type/list/full', {
      schema: z.array(
        z.object({ items: z.array(findingDefinitionSchema).default([]) }).passthrough(),
      ),
    });

    const all = full.flatMap((type) => type.items);
    expect(all.some((item) => item.dataType === 'array')).toBe(true);
    expect(all.some((item) => item.type === null || item.type === undefined)).toBe(true);

    // And the kinds the wizard derives from them stay distinct.
    const multi = all.find((item) => item.dataType === 'array');
    expect(multi?.options.length).toBeGreaterThan(1);
  }, 60_000);

  it('parses organizations and credit balances', async () => {
    const organizations = await getUserOrganizations(client, userId);
    expect(Array.isArray(organizations)).toBe(true);

    const credits = await getScanReviewCredits(client);
    expect(typeof credits.userCredits).toBe('number');
    expect(Array.isArray(credits.groups)).toBe(true);
  }, 30_000);

  it('presigns against a draft id that is not a real scan', async () => {
    const draftId = mintDraftId();

    const presigned = await uploadPresign(client, {
      scanId: draftId,
      key: buildScanFilekey('probe.png'),
      contentType: 'image/png',
    });

    // The route validates the ObjectId FORMAT and never looks the scan up,
    // which is what lets the wizard start uploading before a scan exists.
    expect(presigned.key).toContain(`/scan/${draftId}/`);
    expect(presigned.url).toMatch(/^https:\/\//);
  }, 30_000);

  it('rejects a malformed draft id', async () => {
    await expect(
      uploadPresign(client, { scanId: 'not-an-object-id', key: 'x.png', contentType: 'image/png' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  }, 30_000);

  describe.skipIf(!WRITE)('background-first upload, end to end', () => {
    it('uploads before the scan exists, then creates the scan around the key', async () => {
      const draftId = mintDraftId();
      const filename = `sector-live-${Date.now()}.png`;

      // 1. Bytes first — no scan record anywhere yet.
      const presigned = await uploadPresign(client, {
        scanId: draftId,
        key: buildScanFilekey(filename),
        contentType: 'image/png',
      });
      await putToPresignedUrl(presigned.url, TINY_PNG.buffer.slice(0) as ArrayBuffer, 'image/png');

      // 2. The scan, built around the key the bytes actually landed under.
      //    create() stores `filepath` verbatim; /add-files would rebuild it
      //    around the new scan id and 400 because nothing is there.
      const types = await getScanTypes(client);
      const scanType = types[0];
      expect(scanType).toBeDefined();

      const groups = await getScanUserGroups(client);

      const file = {
        batchId: draftId,
        filename,
        filesize: TINY_PNG.byteLength,
        filetype: 'image/png',
        filepath: presigned.key,
        originalFilename: filename,
        status: 'pending' as const,
      };

      const created = await createScan(client, {
        scanTypeId: scanType!.id,
        fileTotal: 1,
        findings: [],
        note: 'sector live contract check',
        groupIds: groups.map((group) => group.id),
        notifyUser: false,
        files: [file],
        fileDetails: [file],
      });

      expect(created.status).toBe('pending');
      expect(created.fileCount).toBe(0);
      expect(created.files[0]?.filepath).toBe(presigned.key);

      // 3. Confirm the file. No `filepath` in the body: the server verifies the
      //    stored key, increments fileCount, and flips the scan to `submitted`
      //    on the last file.
      const fileId = created.files[0]?.id;
      expect(fileId).toBeTruthy();
      await updateScanFileStatus(client, fileId!, { status: 'completed', scanId: created.id });
      await updateFileDetailsStatus(client, created.id, { filename, status: 'completed' });

      const detail = await client.get(`/api/scan/${created.id}/get`, { schema: scanSchema });
      expect(detail.status).toBe('submitted');
      expect(detail.fileCount).toBe(1);
      // A CloudFront URL means the DB row points at an object that really exists.
      expect(detail.files[0]?.url).toBeTruthy();
    }, 60_000);
  });
});
