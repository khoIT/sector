import { cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sector/ui';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cardColumns } from './card-columns';
import type { ListColumn } from './column-model';
import type { SortState } from './list-url-state';

export type DataCardListProps<TRow> = {
  columns: Array<ListColumn<TRow>>;
  rows: TRow[];
  rowKey: (row: TRow) => string;
  sort: SortState[];
  onSortChange: (sort: SortState[]) => void;
  caption?: string;
  /** A tap anywhere on the card opens it. Omit to leave cards inert. */
  onActivate?: (row: TRow, target: EventTarget | null) => void;
};

/**
 * The same rows as `DataTable`, one card each, for a screen too narrow to
 * hold a table.
 *
 * A six-column table on a 390px phone has two honest options: scroll
 * sideways, or stop being a table. It was doing neither — the expert queue
 * dragged the whole DOCUMENT 1,118px sideways, so the nav and the tab strip
 * slid away with it and the page could not be read at all.
 *
 * Renders from the SAME `columns` array the table is given, so a column added
 * to one appears in the other. That is the whole reason this takes columns
 * rather than a bespoke card shape.
 *
 * `column.className` is deliberately NOT applied here: those are table
 * geometry (fixed widths, alignment) and mean nothing in a stacked card.
 */
export function DataCardList<TRow>({
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  caption,
  onActivate,
}: DataCardListProps<TRow>) {
  const { head, fields, actions } = cardColumns(columns);

  return (
    <div className="flex flex-col gap-2">
      <CardSort columns={columns} sort={sort} onSortChange={onSortChange} />

      <ul className="flex flex-col gap-2" aria-label={caption}>
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            onClick={onActivate ? (event) => onActivate(row, event.target) : undefined}
            className={cn(
              'flex flex-col gap-2 rounded-token border border-line bg-surface p-3',
              onActivate && 'cursor-pointer',
            )}
          >
            {head ? <div className="min-w-0 text-body text-ink">{head.cell(row)}</div> : null}

            {fields.length > 0 ? (
              <dl className="flex flex-col gap-1">
                {fields.map((column) => (
                  <div key={column.id} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-[11px] uppercase tracking-wide text-ink-dim">
                      {column.header}
                    </dt>
                    <dd
                      className={cn(
                        'min-w-0 text-right text-[12px] text-ink',
                        column.numeric && 'sv-num',
                      )}
                    >
                      {column.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {/* A blank header means a row of controls, not a value with a
                label. Rendering it as a `<dt>`/`<dd>` pair puts an empty term
                beside it; here it gets the width instead. */}
            {actions.length > 0 ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-2">
                {actions.map((column) => (
                  <div key={column.id}>{column.cell(row)}</div>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Sort, for a screen with no table header to click.
 *
 * Sorting lived entirely in the header cells, which do not exist below `sm`.
 * That left a phone able to filter and search a queue whose entire point is
 * "longest waiting first" but unable to change its order — it got whatever
 * the URL happened to carry.
 */
function CardSort<TRow>({
  columns,
  sort,
  onSortChange,
}: {
  columns: Array<ListColumn<TRow>>;
  sort: SortState[];
  onSortChange: (sort: SortState[]) => void;
}) {
  const { t } = useTranslation();
  const labelId = useId();
  const sortable = columns.filter((column) => column.sortField);

  if (sortable.length === 0) return null;

  const active = sort[0];
  // The active column can be one the reader has since hidden, in which case
  // there is nothing to show as selected and the placeholder is the truth.
  const activeColumn = sortable.find((column) => column.id === active?.id);
  const descending = active?.desc ?? true;

  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className="shrink-0 text-[11px] uppercase tracking-wide text-ink-dim">
        {t('toolbar.sortBy')}
      </span>

      <Select
        value={activeColumn?.id ?? ''}
        onValueChange={(id) => onSortChange([{ id, desc: true }])}
      >
        <SelectTrigger aria-labelledby={labelId} className="w-auto flex-1">
          <SelectValue placeholder={t('toolbar.sortNone')} />
        </SelectTrigger>
        <SelectContent>
          {sortable.map((column) => (
            <SelectItem key={column.id} value={column.id}>
              {column.header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        disabled={!activeColumn}
        onClick={() => activeColumn && onSortChange([{ id: activeColumn.id, desc: !descending }])}
        // Labels the ACTION, not the current state: the icon already shows
        // which way the list runs, and a button named after where it already
        // is tells a screen-reader user nothing about what pressing it does.
        aria-label={t(descending ? 'toolbar.sortAscending' : 'toolbar.sortDescending')}
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-token border border-line',
          'bg-surface text-ink-dim outline-none transition-colors',
          'hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-ink',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        {descending ? (
          <ArrowDown className="h-4 w-4" aria-hidden />
        ) : (
          <ArrowUp className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
