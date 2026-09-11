import { describe, expect, it } from 'vitest';

import { formatBytes, formatDate, formatDateTime } from './format';

/**
 * These formatters were duplicated across the create-scan and scan-detail
 * surfaces with DIFFERENT rounding, so the same file rendered two ways. The
 * cases below pin the merged behaviour.
 */
describe('formatBytes', () => {
  it('reports raw bytes below a kilobyte', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(938)).toBe('938 B');
  });

  it('keeps one decimal below ten in a unit and none above', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(24 * 1024)).toBe('24 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });

  it('scales past megabytes, which the create-scan copy did not', () => {
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
  });

  it('renders an em dash rather than NaN for unusable input', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(undefined)).toBe('—');
    expect(formatBytes(-1)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('date formatters', () => {
  it('renders a parseable ISO timestamp', () => {
    // Locale-dependent output, so assert the parts rather than the exact string.
    const formatted = formatDateTime('2026-08-14T09:31:00.000Z');
    expect(formatted).not.toBe('—');
    expect(formatted).toMatch(/2026/);
  });

  it('drops the time for the list date columns', () => {
    const dateOnly = formatDate('2026-08-14T09:31:00.000Z');
    expect(dateOnly).toMatch(/2026/);
    expect(dateOnly).not.toMatch(/:/);
  });

  it('renders an em dash for missing or unparseable values', () => {
    for (const bad of [null, undefined, '', 'not a date']) {
      expect(formatDateTime(bad)).toBe('—');
      expect(formatDate(bad)).toBe('—');
    }
  });
});
