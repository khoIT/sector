import { isApiError, usePathologyCategories, usePathologyGalleryList } from '@sector/api-client';
import { Button, EmptyState, Skeleton } from '@sector/ui';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CategoryBar } from './category-bar';
import { PathologyCard } from './pathology-card';
import { SubCategoryRail } from './sub-category-rail';
import { useGalleryParams } from './use-gallery-params';

const PAGE_SIZE = 20;

/**
 * The pathology gallery: a category bar, a sub-category rail and a card grid
 * with a clip in a dialog. Read-only — no permission required beyond being
 * signed in, matching the three routes it calls.
 *
 * Three legacy defects, not repeated here:
 *  1. The default category and the category bar now read the SAME query
 *     (`usePathologyCategories`), so a first visit cannot land on a
 *     highlighted-nothing, empty-grid state — see `category-bar.tsx`.
 *  2. The categories endpoint is cached server-side (see the API's
 *     `pathology-gallery.controller.ts`), so this page no longer pays for a
 *     collection scan and a presign per scan type on every load.
 *  3. The list query only ever fires once the selected category has been
 *     RESOLVED against the loaded category list (`canFetchList` below) —
 *     never merely once a category name sits in the URL. Firing on URL
 *     presence alone would refetch the unfiltered list for one render while
 *     the category list is still loading, exactly the wasted, thrown-away
 *     fetch the legacy page made on every load.
 */
export function GalleryPage() {
  const { t } = useTranslation();
  const params = useGalleryParams();

  const categoriesQuery = usePathologyCategories();
  const selectedCategory = categoriesQuery.data?.find((entry) => entry.name === params.category);
  const canFetchList =
    Boolean(params.category) && categoriesQuery.isSuccess && Boolean(selectedCategory);

  const listQuery = usePathologyGalleryList({
    query: {
      scanTypeId: selectedCategory?.id ?? undefined,
      // Unmapped categories (id: null) have no scan-type relation to filter
      // by, so they fall back to the legacy free-text `category` field.
      category: selectedCategory && !selectedCategory.id ? selectedCategory.name : undefined,
      subCategory: params.subCategory || undefined,
      page: params.page,
      limit: PAGE_SIZE,
    },
    enabled: canFetchList,
  });

  const items = listQuery.data?.items ?? [];
  const totalPages = listQuery.data?.totalPages ?? 0;

  return (
    <section aria-label={t('gallery.title')} className="flex flex-col gap-4">
      <h2 className="text-[17px] font-semibold text-ink">{t('gallery.title')}</h2>

      <CategoryBar selected={params.category} onSelect={params.setCategory} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <aside>
          {params.category ? (
            <SubCategoryRail
              category={params.category}
              selected={params.subCategory}
              onSelect={params.setSubCategory}
            />
          ) : null}
        </aside>

        <div>
          {!canFetchList && !categoriesQuery.isError && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: PAGE_SIZE }, (_, index) => (
                <Skeleton key={index} className="aspect-video w-full rounded-token" />
              ))}
            </div>
          )}

          {categoriesQuery.isError && (
            <EmptyState
              tone="crit"
              icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
              title={t('gallery.categoriesError.title')}
              description={
                isApiError(categoriesQuery.error) ? categoriesQuery.error.message : undefined
              }
            />
          )}

          {canFetchList && listQuery.isPending && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: PAGE_SIZE }, (_, index) => (
                <Skeleton key={index} className="aspect-video w-full rounded-token" />
              ))}
            </div>
          )}

          {canFetchList && listQuery.isError && (
            <EmptyState
              tone="crit"
              icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
              title={t('gallery.loadError.title')}
              description={isApiError(listQuery.error) ? listQuery.error.message : undefined}
              action={
                <Button variant="secondary" size="sm" onClick={() => void listQuery.refetch()}>
                  {t('gallery.loadError.retry')}
                </Button>
              }
            />
          )}

          {canFetchList && listQuery.isSuccess && items.length === 0 && (
            <EmptyState title={t('gallery.noItems')} />
          )}

          {canFetchList && items.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((item) => (
                  <PathologyCard key={item.id} pathology={item} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={params.page <= 1 || listQuery.isFetching}
                    onClick={() => params.setPage(params.page - 1)}
                    aria-label={t('pagination.previous')}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </Button>
                  <span className="text-body text-ink-dim">
                    {t('gallery.pageOf', { current: params.page, total: totalPages })}
                  </span>
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={params.page >= totalPages || listQuery.isFetching}
                    onClick={() => params.setPage(params.page + 1)}
                    aria-label={t('pagination.next')}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
