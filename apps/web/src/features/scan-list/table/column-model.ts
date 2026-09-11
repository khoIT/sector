import type { ReactNode } from 'react';

import type { SortState } from './list-url-state';

/**
 * A column definition for the Scan Vault tables.
 *
 * Deliberately a plain descriptor rather than a TanStack `ColumnDef`. Every
 * table here is `manualFiltering + manualSorting + manualPagination` — the
 * server does all three — so the table library would be left managing only
 * column visibility and a render loop, in exchange for generics that have to
 * be threaded through two unrelated row types (Scan and SharedScanListItem).
 * This descriptor is the part that was actually being used.
 */
export type ListColumn<TRow> = {
  /** Stable id: used for visibility state and as the sort state's key. */
  id: string;
  header: string;
  cell: (row: TRow) => ReactNode;
  /**
   * API sort field for this column. Omit to make the column unsortable.
   * Must be one of the server's whitelisted fields, or the server silently
   * sorts by createdAt instead of what the arrow is showing.
   */
  sortField?: string;
  /**
   * Flip the direction sent to the server. Set on Waiting: "longest waiting
   * first" is descending waiting time, which is ASCENDING createdAt.
   */
  invertSort?: boolean;
  /** Right-align with tabular figures. */
  numeric?: boolean;
  /** Columns the table is unusable without cannot be hidden. */
  alwaysVisible?: boolean;
  /** Hidden until the user turns it on in the column menu. */
  defaultHidden?: boolean;
  /** Extra classes for both the header cell and the body cells. */
  className?: string;
};

/** Convert the table's sort state into the `{id, desc}` the API client expects. */
export function toApiSort<TRow>(columns: Array<ListColumn<TRow>>, sort: SortState[]): SortState[] {
  const active = sort[0];
  if (!active) return [];

  const column = columns.find((candidate) => candidate.id === active.id);
  if (!column?.sortField) return [];

  return [
    {
      id: column.sortField,
      desc: column.invertSort ? !active.desc : active.desc,
    },
  ];
}

export function visibleColumns<TRow>(
  columns: Array<ListColumn<TRow>>,
  hidden: ReadonlySet<string>,
): Array<ListColumn<TRow>> {
  return columns.filter((column) => column.alwaysVisible || !hidden.has(column.id));
}

/** The hidden set a view starts with, before the user touches the column menu. */
export function defaultHiddenColumns<TRow>(columns: Array<ListColumn<TRow>>): string[] {
  return columns.filter((column) => column.defaultHidden).map((column) => column.id);
}
