import { describe, expect, it } from 'vitest';

import {
  exceedsFileLimit,
  formatMegabytes,
  MAX_STUDY_BYTES,
  wouldExceedStudyLimit,
} from './upload-limits';

describe('MAX_STUDY_BYTES', () => {
  it('is 200 MB, matching the legacy dashboard cap', () => {
    expect(MAX_STUDY_BYTES).toBe(200 * 1024 * 1024);
  });
});

describe('formatMegabytes', () => {
  it('rounds to whole megabytes', () => {
    expect(formatMegabytes(200 * 1024 * 1024)).toBe('200 MB');
    expect(formatMegabytes(1.5 * 1024 * 1024)).toBe('2 MB');
  });
});

describe('exceedsFileLimit', () => {
  it('accepts a file at exactly the cap', () => {
    expect(exceedsFileLimit(MAX_STUDY_BYTES)).toBe(false);
  });

  it('rejects a file one byte over the cap', () => {
    expect(exceedsFileLimit(MAX_STUDY_BYTES + 1)).toBe(true);
  });
});

describe('wouldExceedStudyLimit', () => {
  it('allows a file that lands exactly on the cap', () => {
    expect(wouldExceedStudyLimit(MAX_STUDY_BYTES - 10, 10)).toBe(false);
  });

  it('refuses a file that would push the study one byte over', () => {
    expect(wouldExceedStudyLimit(MAX_STUDY_BYTES - 10, 11)).toBe(true);
  });

  it('refuses on an empty study when the single file alone exceeds the cap', () => {
    expect(wouldExceedStudyLimit(0, MAX_STUDY_BYTES + 1)).toBe(true);
  });
});
