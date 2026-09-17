import { describe, expect, it } from 'vitest';

import {
  filterCommands,
  MAX_PER_GROUP,
  normaliseForMatch,
  rankCommand,
  type CommandItem,
} from './filter-commands';

function item(overrides: Partial<CommandItem> & Pick<CommandItem, 'id'>): CommandItem {
  return { group: 'nav', label: overrides.id, path: `/${overrides.id}`, ...overrides };
}

describe('normaliseForMatch', () => {
  it('folds case and strips diacritics, so "resume" finds "Résumé"', () => {
    expect(normaliseForMatch('Résumé')).toBe('resume');
    expect(normaliseForMatch('  Ärztin ')).toBe('arztin');
  });
});

describe('rankCommand', () => {
  it('ranks a prefix above a word start above a substring', () => {
    expect(rankCommand('Group Scans', 'gro')).toBeGreaterThan(rankCommand('My Group', 'gro'));
    expect(rankCommand('My Group', 'gro')).toBeGreaterThan(rankCommand('Regroup', 'gro'));
  });

  it('is 0 for no match at all', () => {
    expect(rankCommand('Group Scans', 'zzz')).toBe(0);
  });

  it('treats an empty query as matching everything equally', () => {
    expect(rankCommand('anything', '')).toBe(1);
    expect(rankCommand('anything', '   ')).toBe(1);
  });

  it('finds a word start after a non-letter separator', () => {
    expect(rankCommand('FAST/E-FAST', 'e')).toBe(2);
  });
});

describe('filterCommands', () => {
  const items = [
    item({ id: 'home', label: 'Home' }),
    item({ id: 'group-scans', label: 'Group Scans' }),
    item({ id: 's1', group: 'scan', label: 'Gallbladder study' }),
    item({ id: 'c1', group: 'course', label: 'General POCUS Essentials' }),
  ];

  it('shows navigation only for an empty query', () => {
    // Cached scans are there to be searched for, not to be a recently-viewed
    // list the learner reads past to reach what they opened the menu for.
    expect(filterCommands(items, '').map((entry) => entry.id)).toEqual(['home', 'group-scans']);
  });

  it('searches across every source once there is a query', () => {
    expect(filterCommands(items, 'g').map((entry) => entry.id)).toEqual([
      'group-scans',
      's1',
      'c1',
    ]);
  });

  it('returns groups in menu order, not in rank order across groups', () => {
    // A perfectly-matching scan must not jump above the navigation block, or
    // the menu's shape changes under the learner as they type.
    const ordered = filterCommands(items, 'gallbladder');

    expect(ordered.map((entry) => entry.group)).toEqual(['scan']);
    expect(filterCommands(items, 'g').map((entry) => entry.group)).toEqual([
      'nav',
      'scan',
      'course',
    ]);
  });

  it('ranks within a group', () => {
    const ranked = filterCommands(
      [
        item({ id: 'a', label: 'My Group Scans' }),
        item({ id: 'b', label: 'Group Administration' }),
      ],
      'group',
    );

    expect(ranked.map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('caps each group so the menu stays scannable', () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      item({ id: `scan-${index}`, group: 'scan', label: `Scan ${index}` }),
    );

    expect(filterCommands(many, 'scan')).toHaveLength(MAX_PER_GROUP);
  });

  it('drops everything when nothing matches', () => {
    expect(filterCommands(items, 'zzzzz')).toEqual([]);
  });
});
