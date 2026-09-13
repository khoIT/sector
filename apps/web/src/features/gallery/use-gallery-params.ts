import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Gallery state lives in the URL, same reasoning as
 * `features/scan-list/table/use-list-url-state.ts`: a bookmark or a pasted
 * link should reopen the same category, sub-category and page. Built on
 * react-router's `useSearchParams` rather than nuqs for the same reason that
 * file gives — nuqs v2 needs a `<NuqsAdapter>` the shell does not mount.
 */
export type GalleryParams = {
  /** The scan type name, or an unmapped category's raw name. Empty until a category is chosen. */
  category: string;
  /** Empty string means "all sub-categories". */
  subCategory: string;
  page: number;
};

export type GalleryParamsApi = GalleryParams & {
  /** Selecting a category resets sub-category and page — a stale sub-category from the previous category would silently narrow the new one to nothing. */
  setCategory: (category: string) => void;
  setSubCategory: (subCategory: string) => void;
  setPage: (page: number) => void;
};

function parsePage(raw: string | null): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function useGalleryParams(): GalleryParamsApi {
  const [searchParams, setSearchParams] = useSearchParams();

  const category = searchParams.get('category') ?? '';
  const subCategory = searchParams.get('subCategory') ?? '';
  const page = parsePage(searchParams.get('page'));

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          mutate(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setCategory = useCallback(
    (value: string) => {
      update((params) => {
        if (value) params.set('category', value);
        else params.delete('category');
        params.delete('subCategory');
        params.delete('page');
      });
    },
    [update],
  );

  const setSubCategory = useCallback(
    (value: string) => {
      update((params) => {
        if (value) params.set('subCategory', value);
        else params.delete('subCategory');
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

  return { category, subCategory, page, setCategory, setSubCategory, setPage };
}
