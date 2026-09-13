import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  getPathologyCategories,
  getPathologyGalleryList,
  getPathologySubCategories,
  type PathologyGalleryListQuery,
} from '../endpoints/pathology';
import { pathologyKeys } from '../query-keys';
import { useApiClient } from './api-provider';

/**
 * The category bar. Cached server-side, so this is a cheap, always-on query —
 * the page that decides the DEFAULT category reads this same hook, not a
 * second endpoint, which is the fix for the legacy defect where the default
 * category came from one route and the bar rendered from another.
 */
export function usePathologyCategories() {
  const client = useApiClient();

  return useQuery({
    queryKey: pathologyKeys.categories(),
    queryFn: ({ signal }) => getPathologyCategories(client, signal),
  });
}

export type UsePathologyGalleryListOptions = {
  query: PathologyGalleryListQuery;
  /** False until a category is selected — an unfiltered fetch is never issued. */
  enabled: boolean;
};

export function usePathologyGalleryList({ query, enabled }: UsePathologyGalleryListOptions) {
  const client = useApiClient();

  return useQuery({
    queryKey: pathologyKeys.list(query),
    queryFn: ({ signal }) => getPathologyGalleryList(client, query, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function usePathologySubCategories(category: string | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: pathologyKeys.subCategories(category ?? ''),
    queryFn: ({ signal }) => getPathologySubCategories(client, category as string, signal),
    enabled: Boolean(category),
  });
}
