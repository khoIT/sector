import { describe, expect, it } from 'vitest';

import {
  draftFromGroup,
  EMPTY_GROUP_DRAFT,
  slugify,
  validateCreateGroup,
  validateUpdateGroup,
} from './group-form-model';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Cardiac Fellows 2026')).toBe('cardiac-fellows-2026');
  });

  it('collapses repeated separators and trims leading/trailing hyphens', () => {
    expect(slugify('  --Multi   Space--  ')).toBe('multi-space');
  });

  it('is empty for a name with no alphanumerics', () => {
    expect(slugify('***')).toBe('');
  });
});

describe('validateCreateGroup', () => {
  const base = {
    ...EMPTY_GROUP_DRAFT,
    organization: 'org-1',
    name: 'Test Group',
    slug: 'test-group',
  };

  it('accepts a minimal valid draft', () => {
    const result = validateCreateGroup(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        organization: 'org-1',
        name: 'Test Group',
        slug: 'test-group',
      });
    }
  });

  it('rejects a missing organization', () => {
    const result = validateCreateGroup({ ...base, organization: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.organization).toBeDefined();
  });

  it('rejects a slug with invalid characters', () => {
    const result = validateCreateGroup({ ...base, slug: 'Not A Slug!' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.slug).toBeDefined();
  });

  it('rejects an empty name', () => {
    const result = validateCreateGroup({ ...base, name: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toBeDefined();
  });

  it('coerces a blank totalSeats to undefined rather than NaN', () => {
    const result = validateCreateGroup({ ...base, totalSeats: '' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.totalSeats).toBeUndefined();
  });
});

describe('validateUpdateGroup', () => {
  const base = { ...EMPTY_GROUP_DRAFT, name: 'Test Group', slug: 'test-group' };

  it('never requires organization — it is create-only', () => {
    const result = validateUpdateGroup(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect('organization' in result.value).toBe(false);
  });

  it('still rejects an invalid slug', () => {
    const result = validateUpdateGroup({ ...base, slug: 'Bad Slug' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.slug).toBeDefined();
  });
});

describe('draftFromGroup', () => {
  it('marks the slug as already touched, so it stops auto-following the name', () => {
    const draft = draftFromGroup({
      id: 'g1',
      name: 'Existing Group',
      slug: 'existing-group',
      description: 'a group',
      type: 'group',
      totalSeats: 10,
      isFreeTrial: false,
      expirationDate: '2026-12-31T00:00:00.000Z',
    });

    expect(draft.slugTouched).toBe(true);
    expect(draft.totalSeats).toBe('10');
    expect(draft.expirationDate).toBe('2026-12-31');
  });

  it('defaults totalSeats to an empty string when unset', () => {
    const draft = draftFromGroup({ id: 'g1', name: 'G', slug: 'g' });
    expect(draft.totalSeats).toBe('');
    expect(draft.expirationDate).toBe('');
  });
});
