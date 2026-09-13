import { describe, expect, it } from 'vitest';

import {
  GROUP_MEMBER_ROLES,
  GROUP_MEMBER_STATUSES,
  groupMemberSchema,
} from './schemas/group-member';

/**
 * Fixture shaped like `groupMemberService.getAll()` (gusi_nodejs_api) actually
 * projects: `{ id, user: {id, userName, email, firstName, lastName}, role,
 * status, joinedAt, expiresAt, ... }`. The `group` sub-object the aggregation
 * also returns is not part of this schema — see the comment on
 * `groupMemberSchema` for why — so fixtures omit it too.
 */
const baseMember = {
  id: 'm1',
  user: { id: 'u1', userName: 'a.okafor', email: 'a.okafor@nw.edu' },
  role: 'leader',
  status: 'active',
  joinedAt: '2026-01-10T09:00:00.000Z',
};

describe('groupMemberSchema role and status', () => {
  it.each(GROUP_MEMBER_ROLES)('accepts the real role %j', (role) => {
    expect(groupMemberSchema.parse({ ...baseMember, role }).role).toBe(role);
  });

  it.each(GROUP_MEMBER_STATUSES)('accepts the real status %j', (status) => {
    expect(groupMemberSchema.parse({ ...baseMember, status }).status).toBe(status);
  });
});

describe('groupMemberSchema expiresAt', () => {
  it('leaves an omitted expiresAt undefined for an open-ended membership', () => {
    expect(groupMemberSchema.parse(baseMember).expiresAt).toBeUndefined();
  });

  it('keeps an explicit null expiresAt', () => {
    expect(groupMemberSchema.parse({ ...baseMember, expiresAt: null }).expiresAt).toBeNull();
  });

  it('parses a real expiresAt string', () => {
    const parsed = groupMemberSchema.parse({
      ...baseMember,
      expiresAt: '2027-01-10T09:00:00.000Z',
    });
    expect(parsed.expiresAt).toBe('2027-01-10T09:00:00.000Z');
  });
});

describe('groupMemberSchema user', () => {
  it('parses the populated user with the shared userBasicSchema fields', () => {
    const parsed = groupMemberSchema.parse(baseMember);
    expect(parsed.user).toEqual({ id: 'u1', userName: 'a.okafor', email: 'a.okafor@nw.edu' });
  });

  it('drops the nested group snapshot the aggregation also sends', () => {
    const parsed = groupMemberSchema.parse({
      ...baseMember,
      group: { id: 'g1', name: 'Northwestern EM Residency', slug: 'northwestern-em-residency' },
    });
    expect(parsed).not.toHaveProperty('group');
  });
});
