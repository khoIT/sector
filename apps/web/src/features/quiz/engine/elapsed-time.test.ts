import { describe, expect, it } from 'vitest';

import { elapsedSeconds } from './elapsed-time';

describe('elapsedSeconds', () => {
  it('is the whole-second difference between now and the start', () => {
    const started = '2026-01-01T00:00:00.000Z';
    const now = '2026-01-01T00:04:12.000Z';
    expect(elapsedSeconds(started, now)).toBe(252);
  });

  it('is 0 when there is no start time yet', () => {
    expect(elapsedSeconds(null, '2026-01-01T00:00:00.000Z')).toBe(0);
  });

  it('never goes negative for a clock that appears to run backwards', () => {
    const started = '2026-01-01T00:05:00.000Z';
    const now = '2026-01-01T00:00:00.000Z';
    expect(elapsedSeconds(started, now)).toBe(0);
  });

  it('is 0 for an unparsable timestamp rather than NaN', () => {
    expect(elapsedSeconds('not a date', '2026-01-01T00:00:00.000Z')).toBe(0);
    expect(elapsedSeconds('2026-01-01T00:00:00.000Z', 'not a date')).toBe(0);
  });
});
