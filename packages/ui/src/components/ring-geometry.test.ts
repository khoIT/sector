import { describe, expect, it } from 'vitest';

import { clampPercentage, ringArc } from './ring-geometry';

describe('ringArc', () => {
  it('draws a full ring at 100% — offset 0', () => {
    const arc = ringArc(100, 10);
    expect(arc.offset).toBeCloseTo(0, 6);
    expect(arc.circumference).toBeCloseTo(2 * Math.PI * 10, 6);
  });

  it('draws an empty ring at 0% — offset equals the full circumference', () => {
    const arc = ringArc(0, 10);
    expect(arc.offset).toBeCloseTo(arc.circumference, 6);
  });

  it('draws exactly half the ring at 50%', () => {
    const arc = ringArc(50, 10);
    expect(arc.offset).toBeCloseTo(arc.circumference / 2, 6);
  });

  it('scales the circumference with the radius', () => {
    expect(ringArc(50, 20).circumference).toBeCloseTo(2 * ringArc(50, 10).circumference, 6);
  });

  it('clamps a percentage above 100 or below 0', () => {
    expect(ringArc(140, 10).offset).toBeCloseTo(0, 6);
    expect(ringArc(-30, 10).offset).toBeCloseTo(ringArc(-30, 10).circumference, 6);
  });
});

describe('clampPercentage', () => {
  it('clamps to the 0-100 range', () => {
    expect(clampPercentage(150)).toBe(100);
    expect(clampPercentage(-10)).toBe(0);
    expect(clampPercentage(42)).toBe(42);
  });

  it('treats non-finite input as 0', () => {
    expect(clampPercentage(Number.NaN)).toBe(0);
    expect(clampPercentage(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
