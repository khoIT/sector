import type { Scan, ScanReview } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { reviewTurnaroundMs, scanOutcome } from './scan-outcome';

const DAY = 24 * 60 * 60 * 1000;

function review(partial: Partial<ScanReview> = {}): ScanReview {
  return {
    id: 'review-1',
    scan: 'scan-1',
    user: { id: 'u1', userName: 'reviewer', email: 'r@example.test' },
    competencyMeasure: 'achieved',
    refId: null,
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
    ...partial,
  };
}

type OutcomeInput = Pick<
  Scan,
  'status' | 'review' | 'reviewedAt' | 'createdAt' | 'processingError'
>;

function scan(partial: Partial<OutcomeInput> = {}): OutcomeInput {
  return {
    status: 'reviewed',
    review: review(),
    reviewedAt: '2026-01-05T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    processingError: null,
    ...partial,
  };
}

describe('scanOutcome', () => {
  it('says whether the learner passed, not merely that someone looked', () => {
    expect(scanOutcome(scan()).kind).toBe('achieved');
    expect(scanOutcome(scan({ review: review({ competencyMeasure: 'not_achieved' }) })).kind).toBe(
      'not-achieved',
    );
  });

  it('reports no outcome rather than a failure when the field is unreadable', () => {
    // Two stored reviews hold a boolean instead of the enum; the schema reads
    // those back as null. Telling someone they did not pass because a field
    // is corrupt is the one wrong answer here.
    expect(scanOutcome(scan({ review: review({ competencyMeasure: null }) })).kind).toBe(
      'no-outcome',
    );
    expect(scanOutcome(scan({ review: null })).kind).toBe('no-outcome');
  });

  it('carries the turnaround so the learner does not subtract two dates', () => {
    const outcome = scanOutcome(scan());
    expect(outcome.kind).toBe('achieved');
    if (outcome.kind !== 'achieved') return;
    expect(outcome.turnaroundMs).toBe(4 * DAY);
    expect(outcome.reviewedAt).toBe('2026-01-05T00:00:00.000Z');
  });

  it("falls back to the review's own timestamp when reviewedAt is absent", () => {
    const outcome = scanOutcome(scan({ reviewedAt: null }));
    if (outcome.kind !== 'achieved') throw new Error('expected an achieved outcome');
    expect(outcome.reviewedAt).toBe('2026-01-05T00:00:00.000Z');
    expect(outcome.turnaroundMs).toBe(4 * DAY);
  });

  it('surfaces why an upload failed, when the ingest worker recorded it', () => {
    expect(
      scanOutcome(scan({ status: 'failed', processingError: 'De-identification failed' })),
    ).toEqual({ kind: 'failed', error: 'De-identification failed' });
  });

  it('leaves a pre-existing failure as a bare pill rather than an empty line', () => {
    // Null on all 2,220 failures that predate the worker writing this field.
    expect(scanOutcome(scan({ status: 'failed', processingError: null }))).toEqual({
      kind: 'failed',
      error: null,
    });
    expect(scanOutcome(scan({ status: 'failed', processingError: '   ' }))).toEqual({
      kind: 'failed',
      error: null,
    });
  });

  it('defers to the status pill for anything not yet reviewed', () => {
    expect(scanOutcome(scan({ status: 'submitted' })).kind).toBe('status');
    expect(scanOutcome(scan({ status: 'processing' })).kind).toBe('status');
    expect(scanOutcome(scan({ status: 'pending' })).kind).toBe('status');
  });
});

describe('reviewTurnaroundMs', () => {
  it('measures submission to review', () => {
    expect(reviewTurnaroundMs('2026-01-01T00:00:00.000Z', '2026-01-08T00:00:00.000Z')).toBe(
      7 * DAY,
    );
  });

  it('clamps the three rows reviewed before they were created', () => {
    expect(reviewTurnaroundMs('2026-01-08T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(0);
  });

  it('has no answer without both timestamps', () => {
    expect(reviewTurnaroundMs(null, '2026-01-08T00:00:00.000Z')).toBeNull();
    expect(reviewTurnaroundMs('2026-01-01T00:00:00.000Z', null)).toBeNull();
    expect(reviewTurnaroundMs('nonsense', '2026-01-08T00:00:00.000Z')).toBeNull();
  });
});
