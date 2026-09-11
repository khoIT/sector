import {
  useScanList,
  type ListQueryInput,
  type ScanListFilterKey,
} from '@scanvault/api-client';

import { useAuth } from '@/auth/auth-context';

import type { NavBadges } from './nav-config';

/**
 * Only `totalItems` off the envelope is read, so ask for the smallest page the
 * server will return rather than a default page of 20 rows.
 *
 * Module scope keeps the object identical across renders; the cache key it
 * produces is therefore distinct from, and stable alongside, the real list
 * page's key, so the two never fight over one cache entry.
 */
const COUNT_ONLY: ListQueryInput<ScanListFilterKey> = {
  pagination: { pageIndex: 0, pageSize: 1 },
};

/**
 * Live counts for the sidebar badges.
 *
 * The legacy `Menu` type declared `badge?: number` and no menu ever set it.
 * These are the two numbers that actually mean something in a review workflow:
 * how many scans are sitting in the group queue, and how many in the expert
 * queue. Both come from the same list routes the tabs use, so they invalidate
 * together — submitting a review refreshes the badge for free.
 *
 * Each query is disabled unless the role holds the matching permission; the
 * routes 403 otherwise (verified against the live API with all four demo
 * accounts), and a guaranteed-failing request on every page load is noise.
 */
export function useNavBadges(): NavBadges {
  const { can } = useAuth();

  const groupQueue = useScanList({
    view: 'pending',
    filters: COUNT_ONLY,
    enabled: can('view:scan:pending'),
    // The queue count does not need 5-second polling; the list page owns that.
    pollWhileProcessing: false,
  });

  const expertQueue = useScanList({
    view: 'expert',
    filters: COUNT_ONLY,
    enabled: can('view:scan:pending:expert'),
    pollWhileProcessing: false,
  });

  return {
    'group-scans': groupQueue.data?.totalItems,
    'expert-scans': expertQueue.data?.totalItems,
  };
}
