import {
  cn,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@scanvault/ui';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ListColumn } from './column-model';
import type { SortState } from './list-url-state';

export type DataTableProps<TRow> = {
  columns: Array<ListColumn<TRow>>;
  rows: TRow[];
  rowKey: (row: TRow) => string;
  sort: SortState[];
  onSortChange: (sort: SortState[]) => void;
  /** Skeleton rows while the FIRST page loads. Later pages keep the old rows. */
  loading?: boolean;
  /** Rendered instead of the table body when there are no rows. */
  empty?: ReactNode;
  caption?: string;
};

/**
 * The table renderer. It owns no data and no state: rows, sort and visibility
 * all arrive as props, because every one of them lives in the URL.
 */
export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  loading = false,
  empty,
  caption,
}: DataTableProps<TRow>) {
  const activeSort = sort[0];

  if (loading) {
    return (
      <div className="rounded-token border border-line bg-surface">
        <SkeletonTable rows={8} columns={Math.min(columns.length, 6)} />
      </div>
    );
  }

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  function handleSort(column: ListColumn<TRow>) {
    if (!column.sortField) return;
    const isActive = activeSort?.id === column.id;
    // First click on a new column shows the most useful direction: newest or
    // longest-waiting first. Clicking the active column flips it.
    onSortChange([{ id: column.id, desc: isActive ? !activeSort.desc : true }]);
  }

  return (
    <div className="rounded-token border border-line bg-surface">
      <Table>
        {caption ? <caption className="sr-only">{caption}</caption> : null}

        <TableHead>
          <TableRow>
            {columns.map((column) => {
              const isActive = activeSort?.id === column.id;
              const ariaSort = isActive ? (activeSort.desc ? 'descending' : 'ascending') : 'none';

              return (
                <TableHeaderCell
                  key={column.id}
                  numeric={column.numeric}
                  aria-sort={column.sortField ? ariaSort : undefined}
                  className={column.className}
                >
                  {column.sortField ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-[4px] outline-none',
                        'uppercase tracking-wide transition-colors',
                        'focus-visible:ring-2 focus-visible:ring-accent-ink',
                        isActive ? 'text-accent-ink' : 'text-ink-dim hover:text-ink',
                      )}
                    >
                      {column.header}
                      {isActive ? (
                        activeSort.desc ? (
                          <ArrowDown className="h-3 w-3" aria-hidden />
                        ) : (
                          <ArrowUp className="h-3 w-3" aria-hidden />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-50" aria-hidden />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHeaderCell>
              );
            })}
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((column) => (
                <TableCell key={column.id} numeric={column.numeric} className={column.className}>
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
