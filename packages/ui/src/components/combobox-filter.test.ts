import { describe, expect, it } from 'vitest';

import { filterComboboxOptions, nextHighlight, type ComboboxOption } from './combobox-filter';

const OPTIONS: ComboboxOption[] = [
  { value: 'aaa', label: 'AAA', description: 'v5' },
  { value: 'dvt', label: 'DVT', description: 'v5' },
  { value: 'knee', label: 'MSK - Knee', description: 'v5' },
  { value: 'shoulder', label: 'MSK - Shoulder', description: 'v5' },
  { value: 'ob1', label: 'OB 1st Tri', description: 'v5' },
];

describe('filterComboboxOptions', () => {
  it('returns everything for an empty query', () => {
    expect(filterComboboxOptions(OPTIONS, '')).toHaveLength(5);
    expect(filterComboboxOptions(OPTIONS, '   ')).toHaveLength(5);
  });

  it('matches on a substring of the label, case-insensitively', () => {
    expect(filterComboboxOptions(OPTIONS, 'msk').map((o) => o.value)).toEqual(['knee', 'shoulder']);
    expect(filterComboboxOptions(OPTIONS, 'AaA').map((o) => o.value)).toEqual(['aaa']);
  });

  it('requires every term, in any order', () => {
    // The literal string "msk knee" never appears in "MSK - Knee", so a
    // whole-string search would find nothing here.
    expect(filterComboboxOptions(OPTIONS, 'msk knee').map((o) => o.value)).toEqual(['knee']);
    expect(filterComboboxOptions(OPTIONS, 'knee msk').map((o) => o.value)).toEqual(['knee']);
  });

  it('searches the description as well as the label', () => {
    const groups: ComboboxOption[] = [
      { value: 'a', label: 'Class of 2029', description: 'in William Carey University' },
      { value: 'b', label: 'Fellows', description: 'in Global Ultrasound Institute' },
    ];
    expect(filterComboboxOptions(groups, 'carey').map((o) => o.value)).toEqual(['a']);
  });

  it('keeps the incoming order rather than ranking', () => {
    // A list that reorders while typing makes the eye re-scan from the top on
    // every keystroke.
    expect(filterComboboxOptions(OPTIONS, 'v5').map((o) => o.value)).toEqual([
      'aaa',
      'dvt',
      'knee',
      'shoulder',
      'ob1',
    ]);
  });

  it('answers empty rather than throwing when nothing matches', () => {
    expect(filterComboboxOptions(OPTIONS, 'echocardiogram')).toEqual([]);
  });

  it('does not mutate the options it was given', () => {
    const source: ComboboxOption[] = [{ value: 'a', label: 'A' }];
    filterComboboxOptions(source, '').push({ value: 'b', label: 'B' });
    expect(source).toHaveLength(1);
  });

  it('tolerates an option with no description', () => {
    expect(filterComboboxOptions([{ value: 'a', label: 'Alpha' }], 'alpha')).toHaveLength(1);
  });
});

describe('nextHighlight', () => {
  it('lands on the first option when nothing is highlighted yet', () => {
    expect(nextHighlight(-1, 5, 1)).toBe(0);
  });

  it('lands on the last option when arrowing up from nothing', () => {
    expect(nextHighlight(-1, 5, -1)).toBe(4);
  });

  it('steps forward and back', () => {
    expect(nextHighlight(2, 5, 1)).toBe(3);
    expect(nextHighlight(2, 5, -1)).toBe(1);
  });

  it('wraps at both ends', () => {
    expect(nextHighlight(4, 5, 1)).toBe(0);
    expect(nextHighlight(0, 5, -1)).toBe(4);
  });

  it('answers -1 when there is nothing to highlight', () => {
    expect(nextHighlight(-1, 0, 1)).toBe(-1);
    expect(nextHighlight(3, 0, -1)).toBe(-1);
  });
});
