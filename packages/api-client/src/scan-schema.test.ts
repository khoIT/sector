import { describe, expect, it } from 'vitest';

import { scanReviewSchema, scanSchema } from './schemas/scan';

/**
 * Regression guards for stored values that are outside what the domain allows
 * but are nonetheless in the database, verified against local `gusi_dev`.
 *
 * Each one is a whole-page failure rather than a cell failure: the list parses
 * a page of twenty rows in one call, so one unparseable row blanks the other
 * nineteen. That is why tolerance belongs in the schema and not in the cell.
 */

const review = {
  id: 'r1',
  scan: 's1',
  user: { id: 'u1', userName: 'reviewer', email: 'reviewer@example.test' },
  createdAt: '2026-01-21T10:54:51.100Z',
  updatedAt: '2026-01-21T10:54:51.100Z',
};

describe('scanReviewSchema competencyMeasure', () => {
  it.each(['achieved', 'not_achieved', ''] as const)('keeps the stored value %j', (stored) => {
    const parsed = scanReviewSchema.parse({ ...review, competencyMeasure: stored });
    expect(parsed.competencyMeasure).toBe(stored);
  });

  // Two rows on scan AAA-JAN21-00018 store the boolean instead of the enum.
  it.each([true, false, 'ACHIEVED', 0, {}])(
    'reads an out-of-domain %j back as not recorded instead of throwing',
    (stored) => {
      const parsed = scanReviewSchema.parse({ ...review, competencyMeasure: stored });
      expect(parsed.competencyMeasure).toBeNull();
    },
  );

  it('treats a missing measure as not recorded', () => {
    expect(scanReviewSchema.parse(review).competencyMeasure).toBeNull();
  });
});

describe('scanSchema refId', () => {
  const scan = {
    id: 's1',
    title: 'AAA-JAN21-00018',
    user: { id: 'u1', userName: 'learner', email: 'learner@example.test' },
    scanType: { id: 't1', key: 'aaa', name: 'AAA' },
    status: 'reviewed',
    fileTotal: 1,
    fileCount: 1,
    createdAt: '2026-01-21T10:00:00.000Z',
    updatedAt: '2026-01-21T10:00:00.000Z',
  };

  // Pre-GUSI imports carry a number; everything created since carries null.
  it('normalises a numeric legacy identifier to a string', () => {
    expect(scanSchema.parse({ ...scan, refId: 2704 }).refId).toBe('2704');
  });

  it('leaves a null identifier alone', () => {
    expect(scanSchema.parse({ ...scan, refId: null }).refId).toBeNull();
  });
});

describe('scanSchema groups', () => {
  const scan = {
    id: 's1',
    title: 'AAA-JAN21-00018',
    user: { id: 'u1', userName: 'learner', email: 'learner@example.test' },
    scanType: { id: 't1', key: 'aaa', name: 'AAA' },
    status: 'submitted',
    fileTotal: 1,
    fileCount: 1,
    createdAt: '2026-01-21T10:00:00.000Z',
    updatedAt: '2026-01-21T10:00:00.000Z',
  };

  // GET /api/scan/:id/get omits the field entirely; GET /api/scan/list sends it.
  // A default of [] here would let the detail page state that a study routed to
  // a group went to nobody, on the one choice submit cannot undo.
  it('leaves an omitted field undefined rather than inventing an empty list', () => {
    expect(scanSchema.parse(scan).groups).toBeUndefined();
  });

  it('keeps a genuinely empty list, which means the study went to nobody', () => {
    expect(scanSchema.parse({ ...scan, groups: [] }).groups).toEqual([]);
  });

  it('normalises the list route\'s _id key', () => {
    const parsed = scanSchema.parse({ ...scan, groups: [{ _id: 'g1', name: 'Class of 2029' }] });
    expect(parsed.groups).toEqual([{ id: 'g1', name: 'Class of 2029' }]);
  });
});
