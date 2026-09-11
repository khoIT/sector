import type { ApiClient } from '../client';
import { paginatedSchema, type Paginated } from '../envelope';
import { buildListQuery, type ListQueryInput, type ScanListFilterKey } from '../list-query';
import type { ScanListView } from '../query-keys';
import { userGroupSchema, type UserGroup } from '../schemas/common';
import { scanSchema, scanUserSchema, type Scan, type ScanUser } from '../schemas/scan';
import { z } from 'zod';

/**
 * Scan list and detail endpoints for all five views.
 *
 * The five list routes were five verbatim copies of the same function in the
 * legacy client. They differ only by URL, so they are one function here.
 */

const SCAN_LIST_PATH: Record<ScanListView, string> = {
  my: '/api/scan/list',
  pending: '/api/scan/pending/list',
  reviewed: '/api/scan/reviewed/list',
  expert: '/api/scan/expert/list',
  'expert-reviewed': '/api/scan/expert/reviewed/list',
};

/**
 * Note the inconsistency in the last two: the expert detail routes have NO
 * `/get` suffix, unlike my/pending/reviewed. That is the server's shape, not a
 * typo here.
 */
const SCAN_DETAIL_PATH: Record<ScanListView, (scanId: string) => string> = {
  my: (id) => `/api/scan/${id}/get`,
  pending: (id) => `/api/scan/pending/${id}/get`,
  reviewed: (id) => `/api/scan/reviewed/${id}/get`,
  expert: (id) => `/api/scan/expert/${id}`,
  'expert-reviewed': (id) => `/api/scan/expert/reviewed/${id}`,
};

export function scanListPath(view: ScanListView): string {
  return SCAN_LIST_PATH[view];
}

export function scanDetailPath(view: ScanListView, scanId: string): string {
  return SCAN_DETAIL_PATH[view](scanId);
}

const paginatedScanSchema = paginatedSchema(scanSchema);

export async function getScanList(
  client: ApiClient,
  view: ScanListView,
  input: ListQueryInput<ScanListFilterKey> = {},
  signal?: AbortSignal,
): Promise<Paginated<Scan>> {
  return client.get(scanListPath(view), {
    query: buildListQuery(input),
    schema: paginatedScanSchema,
    signal,
  });
}

export async function getScanById(
  client: ApiClient,
  view: ScanListView,
  scanId: string,
  signal?: AbortSignal,
): Promise<Scan> {
  return client.get(scanDetailPath(view, scanId), { schema: scanSchema, signal });
}

/**
 * GET /api/scan/users?type=pending|reviewed
 *
 * Populates the learner/reviewer filter dropdown. Flat array, not paginated.
 * 403s without the matching read permission for that bucket.
 */
export async function getScanUsers(
  client: ApiClient,
  type: 'pending' | 'reviewed',
  signal?: AbortSignal,
): Promise<ScanUser[]> {
  return client.get('/api/scan/users', {
    query: { type },
    schema: z.array(scanUserSchema),
    signal,
  });
}

/** GET /api/scan/user-groups — the group filter source. */
export async function getScanUserGroups(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<UserGroup[]> {
  return client.get('/api/scan/user-groups', {
    schema: z.array(userGroupSchema),
    signal,
  });
}
