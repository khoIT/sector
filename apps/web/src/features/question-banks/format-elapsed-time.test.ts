import { describe, expect, it } from 'vitest';

import { formatElapsedTime } from './format-elapsed-time';

describe('formatElapsedTime', () => {
  it('pads seconds under 10', () => {
    expect(formatElapsedTime(5)).toBe('0:05');
  });

  it('formats minutes and seconds', () => {
    expect(formatElapsedTime(252)).toBe('4:12');
  });

  it('rolls hours into minutes rather than a third segment', () => {
    expect(formatElapsedTime(3661)).toBe('61:01');
  });

  it('treats negative or non-finite input as 0', () => {
    expect(formatElapsedTime(-5)).toBe('0:00');
    expect(formatElapsedTime(Number.NaN)).toBe('0:00');
  });
});
