import { describe, expect, it } from 'vitest';

import { encodeQuery } from './client';
import {
  buildListQuery,
  clampPageSize,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizeSortField,
} from './list-query';

describe('buildListQuery', () => {
  it('defaults to createdAt:desc, page 1 and the server page size', () => {
    expect(buildListQuery()).toEqual({
      sortBy: 'createdAt:desc',
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
    });
  });

  it('converts a 0-based pageIndex to the API 1-based page', () => {
    const query = buildListQuery({ pagination: { pageIndex: 3, pageSize: 25 } });
    expect(query.page).toBe(4);
    expect(query.limit).toBe(25);
  });

  it('clamps limit to the server maximum of 100', () => {
    // The server silently clamps to 100, so asking for 500 and rendering a
    // "500 per page" control would be a lie.
    expect(buildListQuery({ pagination: { pageIndex: 0, pageSize: 500 } }).limit).toBe(
      MAX_PAGE_SIZE,
    );
  });

  it('drops an empty or whitespace-only keyword instead of sending keyword=', () => {
    expect(buildListQuery({ globalFilter: '   ' })).not.toHaveProperty('keyword');
  });

  it('falls back to createdAt for a sort field the server does not accept', () => {
    expect(buildListQuery({ sorting: [{ id: 'notAColumn', desc: false }] }).sortBy).toBe(
      'createdAt:asc',
    );
  });

  it('passes array filter values through for comma encoding', () => {
    const query = buildListQuery({
      columnFilters: [{ id: 'tags', value: ['urgent', 'expert_scan_review'] }],
    });
    expect(query.tags).toEqual(['urgent', 'expert_scan_review']);
    expect(encodeQuery(query)).toContain('tags=urgent%2Cexpert_scan_review');
  });
});

describe('encodeQuery', () => {
  it('escapes a keyword containing & and =', () => {
    // The legacy client concatenated raw values, so this exact input silently
    // corrupted the query string and returned the wrong page of results.
    const encoded = encodeQuery(buildListQuery({ globalFilter: 'a&b=c' }));
    expect(encoded).toContain('keyword=a%26b%3Dc');
    expect(encoded.split('keyword=')[1]?.split('&')[0]).toBe('a%26b%3Dc');
  });

  it('never emits empty parameters or double ampersands', () => {
    const encoded = encodeQuery({ keyword: '', status: null, tags: [], page: 1 });
    expect(encoded).toBe('?page=1');
  });
});

describe('normalizeSortField / clampPageSize', () => {
  it('accepts every whitelisted field and rejects anything else', () => {
    expect(normalizeSortField('reviewedAt')).toBe('reviewedAt');
    expect(normalizeSortField('password')).toBe('createdAt');
    expect(normalizeSortField(undefined)).toBe('createdAt');
  });

  it('falls back to the default for a nonsensical page size', () => {
    expect(clampPageSize(0)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(Number.NaN)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(30)).toBe(30);
  });
});
