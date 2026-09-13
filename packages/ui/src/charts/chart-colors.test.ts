import { describe, expect, it } from 'vitest';

import { CHART_GRID_COLOR, chartToneColor, type ChartTone } from './chart-colors';

const TONES: readonly ChartTone[] = ['neutral', 'accent', 'ok', 'warn', 'crit'];

describe('chartToneColor', () => {
  it('maps every tone to a design token, never a hard-coded hex', () => {
    for (const tone of TONES) {
      expect(chartToneColor(tone)).toMatch(/^var\(--[a-z-]+\)$/);
    }
  });

  it('never uses --accent (the orange fill) as a series colour', () => {
    for (const tone of TONES) {
      expect(chartToneColor(tone)).not.toBe('var(--accent)');
    }
  });

  it('is stable — the same tone always resolves to the same token', () => {
    expect(chartToneColor('ok')).toBe('var(--ok)');
    expect(chartToneColor('warn')).toBe('var(--warn)');
    expect(chartToneColor('crit')).toBe('var(--crit)');
    expect(chartToneColor('accent')).toBe('var(--accent-ink)');
    expect(chartToneColor('neutral')).toBe('var(--ink-dim)');
  });

  it('grid/axis colours are also tokens', () => {
    expect(CHART_GRID_COLOR).toBe('var(--line)');
  });
});
