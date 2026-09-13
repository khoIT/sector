import { describe, expect, it } from 'vitest';

import { radioCardStateClasses } from './radio-card-state';

describe('radioCardStateClasses', () => {
  it('reads as selected only when unrevealed and selected', () => {
    expect(radioCardStateClasses(true, 'unrevealed')).toContain('accent-soft');
    expect(radioCardStateClasses(false, 'unrevealed')).not.toContain('accent-soft');
  });

  it('reads as correct once revealed, regardless of selection', () => {
    expect(radioCardStateClasses(true, 'correct')).toContain('ok-soft');
    expect(radioCardStateClasses(false, 'correct')).toContain('ok-soft');
  });

  it('reads as incorrect once revealed for the wrong pick', () => {
    expect(radioCardStateClasses(true, 'incorrect')).toContain('crit-soft');
  });

  it('reveal state always wins over selection state', () => {
    // A selected option that turned out wrong must not still look "selected".
    expect(radioCardStateClasses(true, 'incorrect')).not.toContain('accent-soft');
  });
});
