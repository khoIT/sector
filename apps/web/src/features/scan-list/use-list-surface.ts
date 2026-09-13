import { LIST_SEARCH_DEBOUNCE_MS } from '@sector/api-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';

import type { ScanVaultView } from './scan-list-views';
import {
  clearHiddenColumns,
  readHiddenColumns,
  writeHiddenColumns,
} from './table/column-visibility-store';
import type { SortState } from './table/list-url-state';
import { useDebouncedValue } from './table/use-debounced-value';
import { useListUrlState, type ListUrlStateApi } from './table/use-list-url-state';
import { writeLastTab } from './tabs/last-tab-store';

export type ListSurface = {
  url: ListUrlStateApi;
  /** Keyword after the 600ms debounce. This is what goes into the query key. */
  debouncedKeyword: string;
  hiddenColumns: Set<string>;
  setHiddenColumns: (hidden: string[]) => void;
  resetHiddenColumns: () => void;
  /** The exact list URL, carried into row links so the detail page can return here. */
  returnUrl: string;
};

/**
 * Everything a list page needs that is not the data itself: URL state, the
 * debounced keyword, per-view column visibility, and the return URL.
 *
 * Also the place the "remember my tab" write happens — landing on a view IS
 * choosing it, so no separate click handler can get out of sync with the URL.
 */
export function useListSurface(
  view: ScanVaultView,
  defaultSort: SortState[],
  defaultHidden: string[],
): ListSurface {
  const { user } = useAuth();
  const location = useLocation();
  const url = useListUrlState(defaultSort);
  const debouncedKeyword = useDebouncedValue(url.keyword, LIST_SEARCH_DEBOUNCE_MS);

  const userId = user?.id;

  useEffect(() => {
    writeLastTab(userId, view);
  }, [userId, view]);

  const [hidden, setHidden] = useState<Set<string>>(() => new Set(defaultHidden));

  // Re-seed when the view changes (the pages share this hook) or when a
  // different user signs in on the same browser.
  useEffect(() => {
    setHidden(new Set(readHiddenColumns(userId, view) ?? defaultHidden));
    // defaultHidden is derived from the view's column set, which is stable per
    // view; depending on the array identity would reset the set every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, view]);

  const setHiddenColumns = useCallback(
    (next: string[]) => {
      setHidden(new Set(next));
      writeHiddenColumns(userId, view, next);
    },
    [userId, view],
  );

  const resetHiddenColumns = useCallback(() => {
    setHidden(new Set(defaultHidden));
    clearHiddenColumns(userId, view);
  }, [defaultHidden, userId, view]);

  const returnUrl = useMemo(
    () => `${location.pathname}${location.search}`,
    [location.pathname, location.search],
  );

  return {
    url,
    debouncedKeyword,
    hiddenColumns: hidden,
    setHiddenColumns,
    resetHiddenColumns,
    returnUrl,
  };
}
