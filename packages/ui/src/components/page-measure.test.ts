import { describe, expect, it } from 'vitest';

import { pageMeasureClass, type PageMeasure } from './page-measure';

describe('pageMeasureClass', () => {
  it('caps a reading page near 42rem', () => {
    // The measure a paragraph can be read at. Already the cap the question
    // bank detail page and the quiz runner chose by hand, so this generalises
    // a decision rather than inventing a fourth one.
    expect(pageMeasureClass('reading')).toContain('max-w-[42rem]');
  });

  it('caps a working page wide enough for a table but not unbounded', () => {
    expect(pageMeasureClass('working')).toContain('max-w-[120rem]');
  });

  it('does not cap a full-bleed page', () => {
    // Media surfaces own their own width; a cap here would letterbox the
    // player on the screens it exists for.
    expect(pageMeasureClass('full')).not.toContain('max-w-');
  });

  it('centres every capped measure', () => {
    // Without `mx-auto` the cap left-aligns the page, which reads as broken at
    // 2200px rather than as a deliberate measure.
    expect(pageMeasureClass('reading')).toContain('mx-auto');
    expect(pageMeasureClass('working')).toContain('mx-auto');
  });

  it('falls back to working when the measure is absent or unknown', () => {
    // A route that forgets its measure gets the one most routes want, not a
    // crash and not full-bleed.
    expect(pageMeasureClass()).toBe(pageMeasureClass('working'));
    expect(pageMeasureClass('nonsense' as PageMeasure)).toBe(pageMeasureClass('working'));
  });

  it('always fills the available width up to the cap', () => {
    // `max-w` alone leaves a grid child shrink-wrapping its content; `w-full`
    // is what makes the cap a measure rather than a maximum nobody reaches.
    for (const measure of ['reading', 'working', 'full'] as const) {
      expect(pageMeasureClass(measure)).toContain('w-full');
    }
  });
});
