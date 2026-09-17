import { describe, expect, it } from 'vitest';

import { routingSummary } from './routing-summary-model';

const POOL = { accountType: 'group', accountId: 'g1', label: 'WCUCOM OMS II' } as const;

describe('routingSummary', () => {
  it('names the default cohort when the learner has not chosen', () => {
    // `null` is untouched, not empty. The two must not read the same.
    const summary = routingSummary({ groupIds: null, expertReview: null });

    expect(summary.groupLabelKey).toBe('createScan.routingSummary.groupsDefault');
    expect(summary.expertLabelKey).toBe('createScan.routingSummary.expertNone');
  });

  it('says nobody when the learner unticked every group', () => {
    // Routing cannot be changed after creation, so a study going to no group
    // at all is the one state that must not look like the default.
    const summary = routingSummary({ groupIds: [], expertReview: null });

    expect(summary.groupLabelKey).toBe('createScan.routingSummary.groupsNone');
    expect(summary.groupCount).toBe(0);
  });

  it('counts the groups the learner picked', () => {
    const summary = routingSummary({ groupIds: ['a', 'b'], expertReview: null });

    expect(summary.groupLabelKey).toBe('createScan.routingSummary.groupsCount');
    expect(summary.groupCount).toBe(2);
  });

  it('names the pool an expert request will spend', () => {
    const summary = routingSummary({ groupIds: ['a'], expertReview: POOL });

    expect(summary.expertLabelKey).toBe('createScan.routingSummary.expertRequested');
    expect(summary.expertPool).toBe('WCUCOM OMS II');
  });

  it('states the request even for a pool that has since drained', () => {
    // Credits are re-read from the API and the expert panel owns that
    // outcome; this line reports what was asked for, not what it will cost.
    const summary = routingSummary({ groupIds: null, expertReview: POOL });

    expect(summary.expertLabelKey).toBe('createScan.routingSummary.expertRequested');
  });

  it('describes both decisions independently', () => {
    const expertOnly = routingSummary({ groupIds: [], expertReview: POOL });

    expect(expertOnly.groupLabelKey).toBe('createScan.routingSummary.groupsNone');
    expect(expertOnly.expertLabelKey).toBe('createScan.routingSummary.expertRequested');
  });
});
