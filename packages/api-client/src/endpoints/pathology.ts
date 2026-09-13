import { z } from 'zod';

import type { ApiClient } from '../client';
import { paginatedSchema, type Paginated } from '../envelope';
import {
  pathologyCategorySchema,
  pathologyGalleryItemSchema,
  type PathologyCategory,
  type PathologyGalleryItem,
} from '../schemas/pathology';

const paginatedPathologyGallerySchema = paginatedSchema(pathologyGalleryItemSchema);

/** Bare string array, not a named export — see manifest.test.ts: only an
 *  exported `*Schema` from `schemas/` needs a fidelity decision, and a list of
 *  free-text sub-category labels has no shape worth a schema of its own. */
const subCategoryListSchema = z.array(z.string());

export type PathologyGalleryListQuery = {
  /** Preferred over `category` when the selected category entry has a real scanTypeId. */
  scanTypeId?: string;
  /** Fallback for an unmapped category bar entry (`id: null`) — filtered by name instead. */
  category?: string;
  subCategory?: string;
  keyword?: string;
  page?: number;
  limit?: number;
};

function pathologyGalleryListParams(query: PathologyGalleryListQuery) {
  return {
    status: 'published',
    page: String(query.page ?? 1),
    limit: String(query.limit ?? 20),
    ...(query.scanTypeId ? { scanTypeId: query.scanTypeId } : {}),
    ...(!query.scanTypeId && query.category ? { category: query.category } : {}),
    ...(query.subCategory ? { subCategory: query.subCategory } : {}),
    ...(query.keyword?.trim() ? { keyword: query.keyword.trim() } : {}),
  };
}

/**
 * GET /api/pathology-gallery/categories — the category bar. Cached server-side
 * for a few minutes (see the API's `pathology-gallery.controller.ts`), so a
 * category a content editor just published can take a short while to appear
 * without a deploy, and never needs one.
 */
export async function getPathologyCategories(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<PathologyCategory[]> {
  return client.get('/api/pathology-gallery/categories', {
    schema: z.array(pathologyCategorySchema),
    signal,
  });
}

/** GET /api/pathology-gallery — the card grid, one category/sub-category page at a time. */
export async function getPathologyGalleryList(
  client: ApiClient,
  query: PathologyGalleryListQuery,
  signal?: AbortSignal,
): Promise<Paginated<PathologyGalleryItem>> {
  return client.get('/api/pathology-gallery', {
    query: pathologyGalleryListParams(query),
    schema: paginatedPathologyGallerySchema,
    signal,
  });
}

/** GET /api/pathology-gallery/sub-categories?category= — the rail under one category. */
export async function getPathologySubCategories(
  client: ApiClient,
  category: string,
  signal?: AbortSignal,
): Promise<string[]> {
  return client.get('/api/pathology-gallery/sub-categories', {
    query: { category },
    schema: subCategoryListSchema,
    signal,
  });
}
