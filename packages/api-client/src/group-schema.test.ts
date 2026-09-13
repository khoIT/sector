import { describe, expect, it } from 'vitest';

import { groupSchema } from './schemas/group';

/**
 * Fixtures shaped like `groupService.getAll()` (gusi_nodejs_api) actually
 * emits, verified against real documents on the local production mirror
 * (`gusi_prod_mirror.groups`).
 */
const baseGroup = {
  id: 'g1',
  name: 'Rural Health Nepal — 2026',
  slug: 'rural-health-nepal-2026',
  parent: null,
};

describe('groupSchema type', () => {
  // ~25% of groups in the production mirror predate the `type` field and
  // never had it backfilled — the key is missing, not null.
  it('leaves an absent type undefined rather than inventing one', () => {
    expect(groupSchema.parse(baseGroup).type).toBeUndefined();
  });

  it.each(['group', 'class'] as const)('accepts the real enum value %j', (type) => {
    expect(groupSchema.parse({ ...baseGroup, type }).type).toBe(type);
  });
});

describe('groupSchema parent', () => {
  it('accepts a root group with no parent', () => {
    expect(groupSchema.parse(baseGroup).parent).toBeNull();
  });

  it('accepts a populated parent, dropping fields the shared schema does not model', () => {
    const parsed = groupSchema.parse({
      ...baseGroup,
      parent: { id: 'p1', name: 'GUSI Fellowship', slug: 'gusi-fellowship', totalSeats: 20 },
    });
    expect(parsed.parent).toEqual({ id: 'p1', name: 'GUSI Fellowship', slug: 'gusi-fellowship' });
  });
});

describe('groupSchema seats and expiry', () => {
  it('defaults totalSeats and isFreeTrial for a legacy row missing them', () => {
    const parsed = groupSchema.parse(baseGroup);
    expect(parsed.totalSeats).toBe(0);
    expect(parsed.isFreeTrial).toBe(false);
  });

  it('keeps an explicit null expirationDate rather than reporting "no data"', () => {
    expect(groupSchema.parse({ ...baseGroup, expirationDate: null }).expirationDate).toBeNull();
  });

  it('parses a real expirationDate string', () => {
    const parsed = groupSchema.parse({ ...baseGroup, expirationDate: '2026-12-31T00:00:00.000Z' });
    expect(parsed.expirationDate).toBe('2026-12-31T00:00:00.000Z');
  });
});

describe('groupSchema member/leader counts', () => {
  it('defaults the count virtuals to 0 when the server omits them', () => {
    const parsed = groupSchema.parse(baseGroup);
    expect(parsed.leaderCount).toBe(0);
    expect(parsed.learnerCount).toBe(0);
    expect(parsed.courseCount).toBe(0);
  });

  it('parses real counts from the populated virtuals', () => {
    const parsed = groupSchema.parse({ ...baseGroup, leaderCount: 5, learnerCount: 121 });
    expect(parsed.leaderCount).toBe(5);
    expect(parsed.learnerCount).toBe(121);
  });
});
