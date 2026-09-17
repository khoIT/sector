import {
  cn,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@sector/ui';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMediaQuery } from '@/lib/use-media-query';

import type { ListColumn } from './column-model';
import { DataCardList } from './data-card-list';
import type { SortState } from './list-url-state';
import { shouldActivateRow } from './row-activation';

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
  /**
   * Where a click anywhere on the row goes. Omit to leave rows inert — a list
   * whose rows do not all open something should not pretend they do.
   */
  rowHref?: (row: TRow) => string;
  /** Navigation state to carry with a row click, matching the row's own links. */
  rowState?: (row: TRow) => unknown;
};

/**
 * Below this, the rows render as cards instead. Tailwind's `sm` breakpoint,
 * restated here because the choice of renderer is a mount decision now, not a
 * `display` one — a `hidden sm:block` pair builds BOTH trees on every device,
 * so a 390px phone showing 100 cards also built a 100-row, eight-column table
 * it can never display, with a second row menu and dialog state per row.
 */
const CARD_VIEW_QUERY = '(max-width: 639.98px)';

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
  rowHref,
  rowState,
}: DataTableProps<TRow>) {
  const activeSort = sort[0];
  const compact = useMediaQuery(CARD_VIEW_QUERY);
  const navigate = useNavigate();

  /**
   * The row-wide click. The title link and the open button still work as
   * links — middle-click, copy-link and back all keep behaving — and this is
   * the rest of the row, which was dead space before.
   */
  function activate(row: TRow, target: EventTarget | null) {
    if (!rowHref) return;
    if (
      !shouldActivateRow({
        target: target as Element | null,
        selectedText: window.getSelection()?.toString(),
      })
    )
      return;

    navigate(rowHref(row), { state: rowState?.(row) });
  }

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

  // A table this wide on a phone cannot be made to fit by scrolling it — the
  // whole document slid sideways and took the navigation with it.
  if (compact) {
    return (
      <DataCardList
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        sort={sort}
        onSortChange={onSortChange}
        caption={caption}
        onActivate={rowHref ? activate : undefined}
      />
    );
  }

  return (
    <>
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
              <TableRow
                key={rowKey(row)}
                onClick={(event) => activate(row, event.target)}
                className={rowHref ? 'cursor-pointer' : undefined}
              >
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
    </>
  );
}
