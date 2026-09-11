import { Button, Input } from '@scanvault/ui';
import { Search, X } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ListColumn } from './column-model';
import { ColumnVisibilityDialog } from './column-visibility-dialog';
import { FilterDialog } from './filter-dialog';
import type { FilterSpec } from './filter-spec';
import type { FilterState } from './list-url-state';

export type DataTableToolbarProps<TRow> = {
  spec: FilterSpec;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  filters: FilterState[];
  onFiltersChange: (filters: FilterState[]) => void;
  columns: Array<ListColumn<TRow>>;
  hiddenColumns: ReadonlySet<string>;
  onHiddenColumnsChange: (hidden: string[]) => void;
  onResetColumns: () => void;
  /** Row count from the server, rendered next to the search box. */
  totalItems?: number;
  children?: ReactNode;
};

/**
 * Search, filters and column visibility.
 *
 * The placeholder comes from the view's filter spec rather than being shared:
 * the legacy V2 toolbar used one component for all six tabs and therefore told
 * a reviewer on the group queue that they were searching "your scans".
 */
export function DataTableToolbar<TRow>({
  spec,
  keyword,
  onKeywordChange,
  filters,
  onFiltersChange,
  columns,
  hiddenColumns,
  onHiddenColumnsChange,
  onResetColumns,
  totalItems,
  children,
}: DataTableToolbarProps<TRow>) {
  return (
    <div className="flex flex-wrap items-center gap-2 pb-3">
      <div className="relative min-w-[14rem] flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-dim"
          aria-hidden
        />
        <Input
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder={spec.searchPlaceholder}
          aria-label={spec.searchPlaceholder}
          className="pl-8 pr-8"
        />
        {keyword ? (
          <button
            type="button"
            onClick={() => onKeywordChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-ink-dim outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-ink"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      {typeof totalItems === 'number' ? (
        <span className="hidden text-body text-ink-dim sm:inline">
          <span className="sv-num">{totalItems.toLocaleString()}</span>{' '}
          {totalItems === 1 ? 'scan' : 'scans'}
        </span>
      ) : null}

      <FilterDialog spec={spec} filters={filters} onApply={onFiltersChange} />

      <ColumnVisibilityDialog
        columns={columns}
        hidden={hiddenColumns}
        onChange={onHiddenColumnsChange}
        onReset={onResetColumns}
      />

      {filters.length > 0 || keyword ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onKeywordChange('');
            onFiltersChange([]);
          }}
        >
          Clear
        </Button>
      ) : null}

      {children}
    </div>
  );
}
