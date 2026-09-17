import { describe, expect, it } from 'vitest';

import { cardColumns } from './card-columns';
import type { ListColumn } from './column-model';

type Row = { id: string };

function column(id: string, overrides: Partial<ListColumn<Row>> = {}): ListColumn<Row> {
  return { id, header: id.toUpperCase(), cell: () => id, ...overrides };
}

describe('cardColumns', () => {
  it('promotes the always-visible column to the card head', () => {
    // A card has no header row, so one column has to carry the identity of the
    // row. `alwaysVisible` already marks the column the table is unusable
    // without, which is the same column.
    const { head } = cardColumns([
      column('learner'),
      column('details', { alwaysVisible: true }),
      column('waiting'),
    ]);

    expect(head?.id).toBe('details');
  });

  it('lists every other column as a field, in declaration order', () => {
    const { fields } = cardColumns([
      column('details', { alwaysVisible: true }),
      column('learner'),
      column('scanType'),
      column('waiting'),
    ]);

    // Declaration order, not sorted: the column array is the author's reading
    // order, and a card that reorders it tells a different story from the
    // table beside it.
    expect(fields.map((field) => field.id)).toEqual(['learner', 'scanType', 'waiting']);
  });

  it('never repeats the head column among the fields', () => {
    const { head, fields } = cardColumns([column('details', { alwaysVisible: true })]);

    expect(head?.id).toBe('details');
    expect(fields).toEqual([]);
  });

  it('falls back to the first column when nothing is marked always-visible', () => {
    // Every shipped view marks one, but a view that forgets should still get a
    // card with a title rather than a headless list of label/value pairs.
    const { head, fields } = cardColumns([column('first'), column('second')]);

    expect(head?.id).toBe('first');
    expect(fields.map((field) => field.id)).toEqual(['second']);
  });

  it('takes the FIRST always-visible column when a view marks several', () => {
    const { head, fields } = cardColumns([
      column('details', { alwaysVisible: true }),
      column('learner', { alwaysVisible: true }),
    ]);

    expect(head?.id).toBe('details');
    expect(fields.map((field) => field.id)).toEqual(['learner']);
  });

  it('returns no head for an empty column list', () => {
    const { head, fields, actions } = cardColumns<Row>([]);

    expect(head).toBeNull();
    expect(fields).toEqual([]);
    expect(actions).toEqual([]);
  });

  it('separates a blank-headered column from the labelled fields', () => {
    // The actions column's header is deliberately empty: a table header over a
    // row of buttons should be blank. In a card that same blank becomes a term
    // with no term — so it renders on its own line instead of as a pair.
    const { fields, actions } = cardColumns([
      column('details', { alwaysVisible: true }),
      column('waiting'),
      column('actions', { header: '' }),
    ]);

    expect(fields.map((field) => field.id)).toEqual(['waiting']);
    expect(actions.map((action) => action.id)).toEqual(['actions']);
  });

  it('treats a whitespace-only header as blank', () => {
    const { fields, actions } = cardColumns([
      column('details', { alwaysVisible: true }),
      column('spacer', { header: '   ' }),
    ]);

    expect(fields).toEqual([]);
    expect(actions.map((action) => action.id)).toEqual(['spacer']);
  });

  it('is given already-visible columns and does not filter again', () => {
    // Visibility is decided once, by `visibleColumns`, and both renderers are
    // handed the result. A second filter here is how the card and the table
    // would start disagreeing about which columns exist.
    const { fields } = cardColumns([
      column('details', { alwaysVisible: true }),
      column('hidden-by-default', { defaultHidden: true }),
    ]);

    expect(fields.map((field) => field.id)).toEqual(['hidden-by-default']);
  });
});
