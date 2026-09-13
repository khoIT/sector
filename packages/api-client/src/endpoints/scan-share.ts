import type { ApiClient } from '../client';
import { paginatedSchema, type Paginated } from '../envelope';
import { sharedScanDetailSchema, type SharedScanDetail } from '../schemas/shared-scan-detail';
import {
  createScanShareResultSchema,
  scanShareSchema,
  scanShareScanId,
  type CreateScanSharePayload,
  type CreateScanShareResult,
  type ScanShare,
} from '../schemas/shared-scan';

const paginatedScanShareSchema = paginatedSchema(scanShareSchema);

const SHARES_PAGE_SIZE = 100;
/** Bound on the paging loop below, so a pathological account cannot hang a page. */
const MAX_SHARE_PAGES = 10;

/**
 * Every share the caller has GRANTED for one scan.
 *
 * There is no server route for exactly this. `GET /api/shared-scans` is
 * recipient-side (it filters on the caller's own email), and the only
 * sharer-side route, `GET /api/shared-scans/all`, filters by `sharedBy` and
 * `status` but NOT by scan — so the scan match has to happen here, and pages
 * have to be walked because a prolific sharer's rows for this scan can sit past
 * the first page.
 *
 * `sharedBy` is mandatory: without it `/all` returns every share in the system,
 * for any user. Never call it unfiltered.
 */
export async function getSharesForScan(
  client: ApiClient,
  params: { scanId: string; sharedBy: string },
  signal?: AbortSignal,
): Promise<ScanShare[]> {
  const matches: ScanShare[] = [];

  for (let page = 1; page <= MAX_SHARE_PAGES; page += 1) {
    const result = await client.get<Paginated<ScanShare>>('/api/shared-scans/all', {
      query: { sharedBy: params.sharedBy, page, limit: SHARES_PAGE_SIZE },
      schema: paginatedScanShareSchema,
      signal,
    });

    for (const share of result.items) {
      if (scanShareScanId(share) === params.scanId) matches.push(share);
    }

    if (result.items.length === 0 || page >= result.totalPages) break;
  }

  return matches;
}

/**
 * POST /api/shared-scans — fans one scan out to N recipient emails.
 *
 * Answers 400 'No valid recipients found' when not one email resolves to a
 * registered, not-already-shared user; otherwise it succeeds and reports the
 * skipped addresses in the result.
 */
export async function createScanShare(
  client: ApiClient,
  payload: CreateScanSharePayload,
  signal?: AbortSignal,
): Promise<CreateScanShareResult> {
  return client.post('/api/shared-scans', {
    body: payload,
    schema: createScanShareResultSchema,
    signal,
  });
}

/** DELETE /api/shared-scans/:id — revokes one recipient. Sends no `data` key. */
export async function deleteScanShare(
  client: ApiClient,
  shareId: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.del(`/api/shared-scans/${shareId}`, { signal });
}

/**
 * GET /api/shared-scans/:id — the recipient's read-only view.
 *
 * Reading it marks the share `opened`, so the "shared with me" list is stale
 * afterwards. 403s for anyone but the recipient, so a sharer cannot use it to
 * inspect their own row — `getSharesForScan` is the sharer-side view.
 */
export async function getSharedScanDetail(
  client: ApiClient,
  shareId: string,
  signal?: AbortSignal,
): Promise<SharedScanDetail> {
  return client.get(`/api/shared-scans/${shareId}`, {
    schema: sharedScanDetailSchema,
    signal,
  });
}
