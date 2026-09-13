import { describe, expect, it } from 'vitest';

import type { SubmitOutcome } from './draft-types';
import { isFullySubmitted } from './submit-outcome';

function outcome(overrides: Partial<SubmitOutcome> = {}): SubmitOutcome {
  return {
    scanId: 'scan-1',
    scanTitle: 'Study-1',
    filesConfirmed: 2,
    filesTotal: 2,
    unconfirmed: [],
    expertReview: 'not-requested',
    expertReviewError: null,
    ...overrides,
  };
}

describe('isFullySubmitted', () => {
  it('is true when every intended file was confirmed', () => {
    expect(isFullySubmitted(outcome())).toBe(true);
  });

  it('is false when a file that reached storage failed to confirm', () => {
    expect(
      isFullySubmitted(
        outcome({ filesConfirmed: 1, unconfirmed: [{ name: 'b.mp4', message: 'failed' }] }),
      ),
    ).toBe(false);
  });

  it('is false when a file never reached storage at all (fileCount < fileTotal)', () => {
    // No `unconfirmed` entry exists for a file that was never registered —
    // this is the case a naive `unconfirmed.length === 0` check would miss.
    expect(isFullySubmitted(outcome({ filesConfirmed: 1, filesTotal: 2 }))).toBe(false);
  });

  it('is false without a created scan', () => {
    expect(isFullySubmitted(outcome({ scanId: null, filesConfirmed: 0, filesTotal: 0 }))).toBe(
      false,
    );
  });

  it('is false when the study intended zero files', () => {
    expect(isFullySubmitted(outcome({ filesConfirmed: 0, filesTotal: 0 }))).toBe(false);
  });
});
