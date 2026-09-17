import { describe, expect, it } from 'vitest';

import {
  filterValue,
  LAYOUT_FILTER_ID,
  filterValues,
  hasActiveNarrowing,
  parseFilters,
  parseLimit,
  parsePage,
  parseSort,
  setFilter,
} from './list-url-state';

/**
 * The URL is user input: hand-edited links, truncated bookmarks and params
 * from a version of the app that no longer exists all arrive here. Every
 * parser is total, and these pin that — a list page that throws because
 * somebody trimmed a character off a URL is a worse failure than one that
 * ignores it.
 */
describe('parsePage', () => {
  it('takes a 1-based page', () => {
    expect(parsePage('3')).toBe(3);
  });

  it('falls back to the first page for anything else', () => {
    for (const raw of [null, '', '0', '-2', '1.5', 'three', '1e3x']) {
      expect(parsePage(raw)).toBe(1);
    }
  });
});

describe('parseLimit', () => {
  it('takes an offered size', () => {
    expect(parseLimit('50')).toBe(50);
  });

  it('clamps a size past the server maximum rather than forwarding it', () => {
    expect(parseLimit('100000')).toBeLessThanOrEqual(100);
  });

  it('falls back to the default for a non-integer', () => {
    expect(parseLimit('abc')).toBe(parseLimit(null));
  });
});

describe('parseSort', () => {
  const fallback = [{ id: 'createdAt', desc: true }];

  it('reads a well-formed sort', () => {
    expect(parseSort('[{"id":"title","desc":false}]', fallback)).toEqual([
      { id: 'title', desc: false },
    ]);
  });

  it('falls back on malformed JSON, a non-array, and entries of the wrong shape', () => {
    expect(parseSort('{[', fallback)).toEqual(fallback);
    expect(parseSort('{"id":"title"}', fallback)).toEqual(fallback);
    expect(parseSort('[{"id":"title","desc":"yes"}]', fallback)).toEqual(fallback);
  });
});

describe('parseFilters', () => {
  it('reads string and array values', () => {
    expect(
      parseFilters('[{"id":"status","value":"pending"},{"id":"type","value":["a","b"]}]'),
    ).toEqual([
      { id: 'status', value: 'pending' },
      { id: 'type', value: ['a', 'b'] },
    ]);
  });

  it('drops empty values, which would narrow by nothing', () => {
    expect(parseFilters('[{"id":"status","value":""},{"id":"type","value":[]}]')).toEqual([]);
  });

  it('returns no filters for malformed input', () => {
    expect(parseFilters('nonsense')).toEqual([]);
    expect(parseFilters(null)).toEqual([]);
  });
});

describe('filterValue / filterValues', () => {
  const filters = [
    { id: 'status', value: 'pending' },
    { id: 'type', value: ['a', 'b'] },
  ];

  it('reads one value by id', () => {
    expect(filterValue(filters, 'status')).toBe('pending');
    expect(filterValue(filters, 'missing')).toBeUndefined();
  });

  it('always reads a list, whichever shape was stored', () => {
    expect(filterValues(filters, 'status')).toEqual(['pending']);
    expect(filterValues(filters, 'type')).toEqual(['a', 'b']);
    expect(filterValues(filters, 'missing')).toEqual([]);
  });
});

describe('setFilter', () => {
  const filters = [
    { id: 'status', value: 'pending' },
    { id: 'type', value: 'fast' },
  ];

  it('replaces a filter, keeping the others', () => {
    expect(setFilter(filters, 'status', 'done')).toEqual([
      { id: 'type', value: 'fast' },
      { id: 'status', value: 'done' },
    ]);
  });

  it('drops a filter set to undefined or to an empty value', () => {
    expect(setFilter(filters, 'status', undefined)).toEqual([{ id: 'type', value: 'fast' }]);
    expect(setFilter(filters, 'status', '')).toEqual([{ id: 'type', value: 'fast' }]);
    expect(setFilter(filters, 'status', [])).toEqual([{ id: 'type', value: 'fast' }]);
  });
});

describe('hasActiveNarrowing', () => {
  it('is true for a keyword', () => {
    expect(hasActiveNarrowing({ keyword: 'lung', filters: [] })).toBe(true);
  });

  it('ignores a keyword of only whitespace', () => {
    expect(hasActiveNarrowing({ keyword: '   ', filters: [] })).toBe(false);
  });

  it('is true for a filter', () => {
    expect(hasActiveNarrowing({ keyword: '', filters: [{ id: 'status', value: 'pending' }] })).toBe(
      true,
    );
  });

  it('is false for neither', () => {
    expect(hasActiveNarrowing({ keyword: '', filters: [] })).toBe(false);
  });

  it('ignores the layout filter, which draws the same rows differently', () => {
    // Switching to the list view must not put "no courses match your filters"
    // in front of a learner, nor offer them a Clear that undoes their layout.
    expect(
      hasActiveNarrowing({ keyword: '', filters: [{ id: LAYOUT_FILTER_ID, value: 'list' }] }),
    ).toBe(false);
  });

  it('still sees a real filter sitting beside the layout one', () => {
    expect(
      hasActiveNarrowing({
        keyword: '',
        filters: [
          { id: LAYOUT_FILTER_ID, value: 'list' },
          { id: 'status', value: 'completed' },
        ],
      }),
    ).toBe(true);
  });
});
