import type { PathologyCategory } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { categoryToSelect } from './gallery-selection';

const category = (name: string, id: string | null = 'id'): PathologyCategory => ({
  id,
  name,
  imageUrl: null,
});

/** The shape the mirror serves: thirteen mapped, two with no scan type behind them. */
const CATEGORIES = [
  category('AAA'),
  category('Echo'),
  category('FAST'),
  category('FAST/EFAST', null),
  category('Rapid Reviews', null),
];

describe('categoryToSelect', () => {
  it('selects the first category when nothing is chosen', () => {
    expect(categoryToSelect(CATEGORIES, '')).toBe('AAA');
  });

  it('leaves a category the server returned alone', () => {
    expect(categoryToSelect(CATEGORIES, 'Echo')).toBeNull();
  });

  it('leaves an unmapped category alone — it has no scan type, not no existence', () => {
    expect(categoryToSelect(CATEGORIES, 'FAST/EFAST')).toBeNull();
  });

  /**
   * The regression. A bookmark to `?category=FAST/EFAST` survives exactly until
   * that category is mapped to a scan type or retired, which is the decision
   * currently open on it. Before this, an unrecognised name selected no tab and
   * fetched nothing, and the grid showed twenty loading placeholders that never
   * resolved: no cards, no empty state, no error.
   */
  it('falls back to the first category when the URL names one that is gone', () => {
    expect(categoryToSelect(CATEGORIES, 'FAST/EFAST (retired)')).toBe('AAA');
    expect(categoryToSelect(CATEGORIES, 'Rapid Reviews OLD')).toBe('AAA');
  });

  it('is case-sensitive, because the server decides the casing it serves', () => {
    expect(categoryToSelect(CATEGORIES, 'echo')).toBe('AAA');
  });

  it('asks for nothing while the category list is still empty', () => {
    expect(categoryToSelect([], 'Echo')).toBeNull();
  });

  it('settles: applying its answer makes the next call a no-op', () => {
    const first = categoryToSelect(CATEGORIES, 'gone');
    expect(first).not.toBeNull();
    expect(categoryToSelect(CATEGORIES, first as string)).toBeNull();
  });
});
