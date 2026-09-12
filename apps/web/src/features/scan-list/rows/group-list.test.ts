import { describe, expect, it } from 'vitest';

import {
  filterGroups,
  groupDisplayName,
  shouldOfferGroupFilter,
  sortGroupsByName,
} from './group-list';

const group = (id: string, name: string) => ({ id, name });

describe('groupDisplayName', () => {
  it('uses the name', () => {
    expect(groupDisplayName(group('g1', 'GUSI Colleagues'))).toBe('GUSI Colleagues');
  });

  it('falls back to the id when the server sent a blank name', () => {
    expect(groupDisplayName(group('g1', ''))).toBe('g1');
    expect(groupDisplayName(group('g1', '   '))).toBe('g1');
  });
});

describe('sortGroupsByName', () => {
  it('sorts alphabetically without regard to case', () => {
    const sorted = sortGroupsByName([
      group('c', 'zebra'),
      group('a', 'Alpha'),
      group('b', 'beta'),
    ]);
    expect(sorted.map((g) => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate its input', () => {
    const input = [group('b', 'beta'), group('a', 'alpha')];
    sortGroupsByName(input);
    expect(input.map((g) => g.id)).toEqual(['b', 'a']);
  });
});

describe('filterGroups', () => {
  const groups = [
    group('a', 'GUSI Emergency Medicine'),
    group('b', 'GUSI Colleagues'),
    group('c', 'Individual Plan'),
  ];

  it('narrows on a case-insensitive substring', () => {
    expect(filterGroups(groups, 'gusi').map((g) => g.id)).toEqual(['a', 'b']);
    expect(filterGroups(groups, 'EMERGENCY').map((g) => g.id)).toEqual(['a']);
  });

  it('returns everything for a blank keyword', () => {
    expect(filterGroups(groups, '   ')).toHaveLength(3);
  });

  it('returns nothing when no name matches', () => {
    expect(filterGroups(groups, 'cardiology')).toEqual([]);
  });
});

describe('shouldOfferGroupFilter', () => {
  it('stays off for a list short enough to read', () => {
    expect(shouldOfferGroupFilter(1)).toBe(false);
    expect(shouldOfferGroupFilter(12)).toBe(false);
  });

  it('turns on past the threshold, where the real data goes to 705', () => {
    expect(shouldOfferGroupFilter(13)).toBe(true);
    expect(shouldOfferGroupFilter(705)).toBe(true);
  });
});
