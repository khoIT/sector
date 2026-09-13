import type { ScanReviewCredits } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import {
  expertReviewCreditSources,
  findCreditSource,
  isChoiceDrained,
} from './expert-review-credit-sources';

function credits(overrides: Partial<ScanReviewCredits> = {}): ScanReviewCredits {
  return {
    userId: 'user-1',
    userCredits: 3,
    totalUserCredits: 5,
    usedUserCredits: 2,
    groupCredits: 0,
    usedGroupCredits: 0,
    totalGroupCredits: 0,
    groups: [],
    ...overrides,
  };
}

describe('expertReviewCreditSources', () => {
  it('lists the personal balance first, with its total and used figures', () => {
    const sources = expertReviewCreditSources('user-1', 'Dana Lee', credits());

    expect(sources[0]).toEqual({
      key: 'user:user-1',
      accountType: 'user',
      accountId: 'user-1',
      label: 'Dana Lee (your balance)',
      credits: 3,
      used: 2,
      total: 5,
    });
  });

  it('appends every group, each with its own figures', () => {
    const sources = expertReviewCreditSources(
      'user-1',
      'Dana Lee',
      credits({
        groups: [
          {
            groupId: 'group-1',
            groupName: 'Emergency Medicine',
            currentCredits: 4,
            usedCredits: 6,
            totalCredits: 10,
          },
        ],
      }),
    );

    expect(sources[1]).toEqual({
      key: 'group:group-1',
      accountType: 'group',
      accountId: 'group-1',
      label: 'Emergency Medicine',
      credits: 4,
      used: 6,
      total: 10,
    });
  });
});

describe('findCreditSource / isChoiceDrained', () => {
  const sources = expertReviewCreditSources(
    'user-1',
    'Dana Lee',
    credits({
      groups: [
        {
          groupId: 'group-1',
          groupName: 'Empty group',
          currentCredits: 0,
          usedCredits: 10,
          totalCredits: 10,
        },
      ],
    }),
  );

  it('finds the source a choice refers to', () => {
    expect(findCreditSource(sources, { accountType: 'group', accountId: 'group-1' })?.label).toBe(
      'Empty group',
    );
  });

  it('returns undefined for no choice or a choice with no matching source', () => {
    expect(findCreditSource(sources, null)).toBeUndefined();
    expect(findCreditSource(sources, { accountType: 'group', accountId: 'gone' })).toBeUndefined();
  });

  it('is not drained when the chosen pool still has credits', () => {
    expect(isChoiceDrained(sources, { accountType: 'user', accountId: 'user-1' })).toBe(false);
  });

  it('is drained once the chosen pool reaches zero', () => {
    expect(isChoiceDrained(sources, { accountType: 'group', accountId: 'group-1' })).toBe(true);
  });

  it('is not drained when there is no choice at all', () => {
    expect(isChoiceDrained(sources, null)).toBe(false);
  });
});
