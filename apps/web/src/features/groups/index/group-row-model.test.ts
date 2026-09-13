import { describe, expect, it } from 'vitest';

import { hasExpiry, seatsUsage } from './group-row-model';

describe('seatsUsage', () => {
  it('reports unlimited when totalSeats is the model default of 0', () => {
    expect(seatsUsage({ totalSeats: 0, learnerCount: 12 })).toBeNull();
  });

  it('reports unlimited when totalSeats is null', () => {
    expect(seatsUsage({ totalSeats: null, learnerCount: 0 })).toBeNull();
  });

  it('reports the used/total fraction when a cap is configured', () => {
    expect(seatsUsage({ totalSeats: 42, learnerCount: 37 })).toEqual({ used: 37, total: 42 });
  });

  it('treats a null learnerCount as zero used rather than throwing', () => {
    expect(seatsUsage({ totalSeats: 10, learnerCount: null })).toEqual({
      used: 0,
      total: 10,
    });
  });
});

describe('hasExpiry', () => {
  it('is false for a group with no expirationDate', () => {
    expect(hasExpiry({ expirationDate: null })).toBe(false);
    expect(hasExpiry({ expirationDate: undefined })).toBe(false);
  });

  it('is true once an expirationDate is set', () => {
    expect(hasExpiry({ expirationDate: '2026-12-31T00:00:00.000Z' })).toBe(true);
  });
});
