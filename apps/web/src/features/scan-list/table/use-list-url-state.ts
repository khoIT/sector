import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  parseFilters,
  parseLimit,
  parsePage,
  parseSort,
  type FilterState,
  type ListUrlState,
  type SortState,
} from './list-url-state';

/**
 * Table state lives in the URL, not in component state.
 *
 * That is what makes "open a scan, press back" return to the exact page,
 * sort and filter set the user left — and what makes a Scan Vault link
 * someone pastes into Slack show the reader the same rows.
 *
 * Built on react-router's own `useSearchParams` rather than nuqs: nuqs v2
 * needs a `<NuqsAdapter>` at the app root, and the root providers are owned by
 * the shell. Swapping the implementation later touches only this file.
 */
export type ListUrlStateApi = ListUrlState & {
  setKeyword: (keyword: string) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSort: (sort: SortState[]) => void;
  setFilters: (filters: FilterState[]) => void;
  clearNarrowing: () => void;
};

export function useListUrlState(defaultSort: SortState[]): ListUrlStateApi {
  const [searchParams, setSearchParams] = useSearchParams();

  const keyword = searchParams.get('keyword') ?? '';
  const page = parsePage(searchParams.get('page'));
  const limit = parseLimit(searchParams.get('limit'));
  const sortRaw = searchParams.get('sort');
  const filtersRaw = searchParams.get('filters');

  const sort = useMemo(() => parseSort(sortRaw, defaultSort), [sortRaw, defaultSort]);
  const filters = useMemo(() => parseFilters(filtersRaw), [filtersRaw]);

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          mutate(next);
          return next;
        },
        // A filter change is not a new place in history: the back button
        // should leave the list, not step through every keystroke.
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setKeyword = useCallback(
    (value: string) => {
      update((params) => {
        if (value) params.set('keyword', value);
        else params.delete('keyword');
        // A narrower result set can have fewer pages than the one being viewed.
        params.delete('page');
      });
    },
    [update],
  );

  const setPage = useCallback(
    (value: number) => {
      update((params) => {
        if (value > 1) params.set('page', String(value));
        else params.delete('page');
      });
    },
    [update],
  );

  const setLimit = useCallback(
    (value: number) => {
      update((params) => {
        params.set('limit', String(value));
        params.delete('page');
      });
    },
    [update],
  );

  // Sorting deliberately does NOT reset the page, matching the legacy tables:
  // a reviewer flipping a column direction is still working through page 4.
  const setSort = useCallback(
    (value: SortState[]) => {
      update((params) => {
        if (value.length > 0) params.set('sort', JSON.stringify(value));
        else params.delete('sort');
      });
    },
    [update],
  );

  const setFilters = useCallback(
    (value: FilterState[]) => {
      update((params) => {
        if (value.length > 0) params.set('filters', JSON.stringify(value));
        else params.delete('filters');
        params.delete('page');
      });
    },
    [update],
  );

  const clearNarrowing = useCallback(() => {
    update((params) => {
      params.delete('keyword');
      params.delete('filters');
      params.delete('page');
    });
  }, [update]);

  return {
    keyword,
    page,
    limit,
    sort,
    filters,
    setKeyword,
    setPage,
    setLimit,
    setSort,
    setFilters,
    clearNarrowing,
  };
}
