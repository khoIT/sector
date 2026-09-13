import { describe, expect, it } from 'vitest';

import { progressMeterPercentage } from './progress-meter-percentage';

describe('progressMeterPercentage', () => {
  it('divides value by max', () => {
    expect(progressMeterPercentage(3, 10)).toBe(30);
    expect(progressMeterPercentage(1, 3)).toBeCloseTo(33.33, 1);
  });

  it('clamps a value past its max to 100', () => {
    expect(progressMeterPercentage(12, 10)).toBe(100);
  });

  it('clamps a negative value to 0', () => {
    expect(progressMeterPercentage(-2, 10)).toBe(0);
  });

  it('returns 0 for a zero or negative max instead of dividing by it', () => {
    expect(progressMeterPercentage(0, 0)).toBe(0);
    expect(progressMeterPercentage(5, 0)).toBe(0);
    expect(progressMeterPercentage(5, -1)).toBe(0);
  });

  it('returns 0 for non-finite input rather than NaN', () => {
    expect(progressMeterPercentage(Number.NaN, 10)).toBe(0);
    expect(progressMeterPercentage(5, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
