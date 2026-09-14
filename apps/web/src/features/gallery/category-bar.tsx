import { isApiError, usePathologyCategories } from '@sector/api-client';
import { Button, EmptyState, Skeleton, cn } from '@sector/ui';
import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { categoryToSelect } from './gallery-selection';

export type CategoryBarProps = {
  selected: string;
  onSelect: (categoryName: string) => void;
};

/**
 * The category bar — served from ONE relation-backed endpoint
 * (`GET /api/pathology-gallery/categories`), the same one the default
 * selection below reads. The legacy dashboard picked its default category
 * from `GET /api/scan-type/list` while this bar rendered from
 * `GET /api/pathology-gallery/categories`; on a first visit those two lists
 * could disagree, landing on a category with no button highlighted and an
 * empty grid. One data source removes the possibility.
 *
 * Every entry the server returns is rendered, including one whose `id` is
 * null (a category that names no scan type). There is no whitelist here —
 * porting the legacy 13-name whitelist into Sector would have reproduced the
 * exact defect this relation exists to fix: a new category published by
 * content staff would be returned by the server and dropped by the client.
 */
export function CategoryBar({ selected, onSelect }: CategoryBarProps) {
  const { t } = useTranslation();
  const query = usePathologyCategories();
  const categories = query.data ?? [];

  useEffect(() => {
    // Covers a first visit with no category chosen AND a URL naming one the
    // server no longer returns — see `categoryToSelect` for why the second is
    // a real path rather than a typo. Left uncorrected it highlighted no tab
    // and fetched nothing, so the grid sat on loading placeholders forever:
    // the dead end this bar was rebuilt to remove, reached through a bookmark
    // instead of a first visit.
    const next = categoryToSelect(categories, selected);
    if (next) onSelect(next);
    // Re-runs when the category list changes, and when the selection moves
    // outside it. `onSelect` replaces the URL in place, and settling on a real
    // category makes the next run a no-op, so this cannot loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, selected]);

  if (query.isPending) {
    return (
      <div className="flex flex-wrap gap-2 border-b border-line pb-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-24 rounded-token" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <EmptyState
        tone="crit"
        icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
        title={t('gallery.categoriesError.title')}
        description={isApiError(query.error) ? query.error.message : undefined}
        action={
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {t('gallery.categoriesError.retry')}
          </Button>
        }
      />
    );
  }

  if (categories.length === 0) {
    return <EmptyState title={t('gallery.noCategories')} />;
  }

  return (
    <div className="flex flex-wrap gap-2 border-b border-line pb-4" role="tablist">
      {categories.map((category) => {
        const isSelected = category.name === selected;
        return (
          <Button
            key={category.id ?? category.name}
            type="button"
            role="tab"
            aria-selected={isSelected}
            variant={isSelected ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onSelect(category.name)}
            className={cn('gap-1.5', isSelected && 'ring-2 ring-accent-ink')}
          >
            {category.imageUrl && (
              <img src={category.imageUrl} alt="" aria-hidden className="h-4 w-4 object-contain" />
            )}
            {category.name}
          </Button>
        );
      })}
    </div>
  );
}
