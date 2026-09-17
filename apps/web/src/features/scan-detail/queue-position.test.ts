import { describe, expect, it } from 'vitest';

import {
  isScanQueueState,
  queueStateForPage,
  resolveQueuePosition,
  type ScanQueueState,
} from './queue-position';

function state(overrides: Partial<ScanQueueState> = {}): ScanQueueState {
  return {
    view: 'expert',
    filters: {},
    ids: ['a', 'b', 'c'],
    index: 1,
    pageIndex: 0,
    pageSize: 3,
    totalItems: 3,
    ...overrides,
  };
}

describe('isScanQueueState', () => {
  it('accepts the shape the list writes', () => {
    expect(isScanQueueState(state())).toBe(true);
  });

  it('rejects anything else, because history state survives a deploy', () => {
    // A bookmarked link arrives with null; an entry written by a previous
    // release can hold a shape this code has never seen.
    for (const value of [
      null,
      undefined,
      'queue',
      42,
      {},
      { view: 'expert' },
      { ...state(), ids: [1, 2] },
    ]) {
      expect(isScanQueueState(value)).toBe(false);
    }
  });
});

describe('resolveQueuePosition', () => {
  it('finds the neighbours either side', () => {
    const position = resolveQueuePosition(state(), 'b');

    expect(position).toMatchObject({ prevId: 'a', nextId: 'c', position: 2, total: 3 });
  });

  it('has no previous at the first row of the first page', () => {
    const position = resolveQueuePosition(state(), 'a');

    expect(position.prevId).toBeNull();
    expect(position.needsPrevPage).toBeNull();
    expect(position.position).toBe(1);
  });

  it('has no next at the last row of the last page', () => {
    const position = resolveQueuePosition(state(), 'c');

    expect(position.nextId).toBeNull();
    expect(position.needsNextPage).toBeNull();
  });

  it('asks for the next page at the end of one that is not the last', () => {
    const position = resolveQueuePosition(
      state({ pageIndex: 0, pageSize: 3, totalItems: 10 }),
      'c',
    );

    expect(position.nextId).toBeNull();
    expect(position.needsNextPage).toBe(1);
  });

  it('asks for the previous page at the start of a later one', () => {
    const position = resolveQueuePosition(
      state({ pageIndex: 2, pageSize: 3, totalItems: 10 }),
      'a',
    );

    expect(position.needsPrevPage).toBe(1);
    expect(position.position).toBe(7);
  });

  it('asks for both when a page holds a single row', () => {
    const position = resolveQueuePosition(
      state({ ids: ['only'], index: 0, pageIndex: 1, pageSize: 1, totalItems: 5 }),
      'only',
    );

    expect(position.needsPrevPage).toBe(0);
    expect(position.needsNextPage).toBe(2);
  });

  it('counts across pages, not within one', () => {
    const position = resolveQueuePosition(
      state({ ids: ['x', 'y'], pageIndex: 3, pageSize: 20, totalItems: 84 }),
      'y',
    );

    expect(position.position).toBe(62);
    expect(position.total).toBe(84);
  });

  it('locates the scan by id, not by the index the link was made with', () => {
    // Someone else reviewing a scan drops it out of Unreviewed and shifts
    // every index after it; trusting the stale one steps over a scan.
    const position = resolveQueuePosition(state({ ids: ['a', 'b', 'c'], index: 0 }), 'c');

    expect(position.prevId).toBe('b');
    expect(position.position).toBe(3);
  });

  it('reports nothing for a scan the carried page no longer holds', () => {
    const position = resolveQueuePosition(state({ ids: [], index: 0 }), 'gone');

    expect(position).toMatchObject({ prevId: null, nextId: null, position: 0 });
  });
});

describe('queueStateForPage', () => {
  it('re-describes the queue from the page the reviewer just stepped onto', () => {
    // Arriving at row 1 of page 2 still holding page 1's ids loses Previous
    // immediately, which reads as "the queue ended".
    const next = queueStateForPage(
      state({ pageIndex: 0 }),
      { ids: ['d', 'e', 'f'], pageIndex: 1, totalItems: 10 },
      'd',
    );

    expect(next).toMatchObject({ ids: ['d', 'e', 'f'], index: 0, pageIndex: 1, totalItems: 10 });
    expect(resolveQueuePosition(next, 'd').needsPrevPage).toBe(0);
  });

  it('keeps the view and the filters the list was using', () => {
    const base = state({ filters: { globalFilter: 'lung' } });

    expect(queueStateForPage(base, { ids: ['z'], pageIndex: 2, totalItems: 9 }, 'z')).toMatchObject(
      {
        view: base.view,
        filters: { globalFilter: 'lung' },
      },
    );
  });

  it('falls back to the first row for a scan the page does not hold', () => {
    expect(
      queueStateForPage(state(), { ids: ['p', 'q'], pageIndex: 1, totalItems: 4 }, 'gone').index,
    ).toBe(0);
  });
});
