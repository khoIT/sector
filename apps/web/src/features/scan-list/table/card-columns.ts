import type { ListColumn } from './column-model';

export type CardColumns<TRow> = {
  /** The column that titles the card. Null only for an empty column list. */
  head: ListColumn<TRow> | null;
  /** Labelled values, as label/value pairs, in declaration order. */
  fields: Array<ListColumn<TRow>>;
  /**
   * Columns with a blank header. A table header cell over a row of buttons is
   * correctly empty, but a card renders each field as a term and its
   * definition, and a term with nothing in it is a visible gap with no meaning.
   * These render on their own line instead.
   */
  actions: Array<ListColumn<TRow>>;
};

/**
 * Split the table's columns into a card's head, its fields and its actions.
 *
 * A card has no header row, so one column has to carry the identity of the
 * row — and the columns already say which one that is. `alwaysVisible` marks
 * the column the table is unusable without (the scan's title, the group's
 * name), which is exactly the column a reader needs to know what they are
 * looking at.
 *
 * Takes the columns the table is ALREADY rendering, after
 * `visibleColumns()` has run. Filtering again here is how the card and the
 * table would start disagreeing about which columns exist — the bug this
 * whole shared-model approach is meant to make impossible.
 */
export function cardColumns<TRow>(columns: Array<ListColumn<TRow>>): CardColumns<TRow> {
  const head = columns.find((column) => column.alwaysVisible) ?? columns[0] ?? null;
  const rest = columns.filter((column) => column !== head);

  return {
    head,
    fields: rest.filter((column) => column.header.trim().length > 0),
    actions: rest.filter((column) => column.header.trim().length === 0),
  };
}
