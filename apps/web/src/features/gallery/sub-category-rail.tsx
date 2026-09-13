import { usePathologySubCategories } from '@sector/api-client';
import { Button, Skeleton, cn } from '@sector/ui';
import { useTranslation } from 'react-i18next';

export type SubCategoryRailProps = {
  category: string;
  selected: string;
  onSelect: (subCategory: string) => void;
};

const ALL_SUB_CATEGORIES = '';

/** The rail under one category. Empty string always means "all sub-categories". */
export function SubCategoryRail({ category, selected, onSelect }: SubCategoryRailProps) {
  const { t } = useTranslation();
  const query = usePathologySubCategories(category);
  const subCategories = query.data ?? [];

  if (query.isPending) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full rounded-token" />
        ))}
      </div>
    );
  }

  return (
    <nav aria-label={t('gallery.subCategoriesFor', { category })} className="space-y-1">
      <Button
        type="button"
        variant={selected === ALL_SUB_CATEGORIES ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onSelect(ALL_SUB_CATEGORIES)}
        className={cn('w-full justify-start', selected === ALL_SUB_CATEGORIES && 'font-semibold')}
      >
        {t('gallery.allSubCategories')}
      </Button>
      {subCategories.map((subCategory) => (
        <Button
          key={subCategory}
          type="button"
          variant={selected === subCategory ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onSelect(subCategory)}
          className={cn(
            'w-full justify-start truncate',
            selected === subCategory && 'font-semibold',
          )}
        >
          {subCategory}
        </Button>
      ))}
    </nav>
  );
}
