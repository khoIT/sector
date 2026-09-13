import { SCAN_STATUS_LABEL, SCAN_STATUSES, SHARED_SCAN_STATUS_LABEL } from '@sector/api-client';

import { isReviewedList, type ScanVaultView } from '../scan-list-views';
import type { FilterOption } from './filter-controls';

/**
 * Which filter sections each view offers, and the vocabulary behind them.
 *
 * The section list is per view because the server's filter sets differ: the
 * /api/scan/* lists take `scanTypeKeys` + `groupIds` + `userIds`, while
 * /api/shared-scans takes `sharedBy` + `scanTypeIds` (IDS, not keys) and its
 * own two-value status. Offering a scan-type filter on Shared Scans would need
 * scan-type IDs, which the filter-options endpoint does not return — so that
 * tab deliberately offers search and share status only.
 */
export type FilterSection = 'scanType' | 'status' | 'tags' | 'groups' | 'users' | 'shareStatus';

export type FilterSpec = {
  sections: FilterSection[];
  /** Which bucket the learner dropdown reads: /api/scan/users?type=… */
  userType: 'pending' | 'reviewed';
  /** Translation key for the search field's placeholder. */
  searchPlaceholderKey: string;
};

export function filterSpecFor(view: ScanVaultView): FilterSpec {
  if (view === 'shared') {
    return {
      sections: ['shareStatus'],
      userType: 'reviewed',
      searchPlaceholderKey: 'toolbar.searchSharedScans',
    };
  }

  if (view === 'my') {
    return {
      sections: ['scanType', 'status', 'tags'],
      userType: 'pending',
      searchPlaceholderKey: 'toolbar.searchMyScans',
    };
  }

  // One filter set for all four queue/record views. The legacy dashboard left
  // the completeness tag off expert-reviewed-scans alone, which reads as an
  // oversight rather than a decision — the server accepts `tags` on every scan
  // list route — so it is offered here too.
  return {
    sections: ['scanType', 'tags', 'groups', 'users'],
    userType: isReviewedList(view) ? 'reviewed' : 'pending',
    searchPlaceholderKey: 'toolbar.searchScans',
  };
}

/**
 * Statuses worth filtering My Scans by. `processing` is excluded on purpose:
 * it lasts seconds and the list polls itself out of that state, so a filter
 * for it would look broken.
 */
export const STATUS_FILTER_OPTIONS: FilterOption[] = SCAN_STATUSES.filter(
  (status) => status !== 'processing',
).map((status) => ({
  value: status,
  // 'pending' reads as "Saved" to a learner: the scan exists but has not been
  // sent for review. The legacy dashboard relabelled it the same way.
  label: status === 'pending' ? 'Saved (not submitted)' : SCAN_STATUS_LABEL[status],
}));

/** The scan tag vocabulary the server recognises, lowercased as it stores them. */
export const TAG_FILTER_OPTIONS: FilterOption[] = [
  { value: 'complete', label: 'Complete' },
  { value: 'incomplete', label: 'Incomplete' },
];

export const SHARE_STATUS_FILTER_OPTIONS: FilterOption[] = (['unopened', 'opened'] as const).map(
  (status) => ({ value: status, label: SHARED_SCAN_STATUS_LABEL[status] }),
);
