import type { GroupMember } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import {
  canResendInvitation,
  memberLabel,
  roleChangeIsRedundant,
  roleChangePayloadFor,
} from './member-actions-model';

function member(overrides: Partial<GroupMember> = {}): GroupMember {
  return {
    id: 'gm1',
    user: {
      id: 'u1',
      userName: 'a.learner',
      email: 'learner@example.com',
      firstName: 'Ada',
      lastName: 'Learner',
    },
    role: 'learner',
    status: 'active',
    joinedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  } as GroupMember;
}

describe('roleChangePayloadFor', () => {
  // The regression: PUT /api/group-members/:id writes
  // `expiresAt: body.expiresAt ? new Date(body.expiresAt) : null`, so a payload
  // that omits expiresAt CLEARS a time-limited membership. 500 rows on the
  // production mirror carry a real date.
  it('echoes an existing expiry back so the server does not clear it', () => {
    const payload = roleChangePayloadFor(
      member({ expiresAt: '2026-12-31T00:00:00.000Z' }),
      'leader',
    );

    expect(payload).toEqual({ role: 'leader', expiresAt: '2026-12-31T00:00:00.000Z' });
  });

  it('sends an explicit null when the member has no expiry, never undefined', () => {
    // `undefined` would be dropped by JSON.stringify, which is the same wire
    // payload as omitting the field — the bug this guards.
    const payload = roleChangePayloadFor(member({ expiresAt: null }), 'leader');

    expect(payload.expiresAt).toBeNull();
    expect('expiresAt' in payload).toBe(true);
  });

  it('sends null when the field is absent from the member row entirely', () => {
    const withoutExpiry = member();
    delete (withoutExpiry as { expiresAt?: unknown }).expiresAt;

    expect(roleChangePayloadFor(withoutExpiry, 'leader').expiresAt).toBeNull();
  });

  it('carries the requested role, not the current one', () => {
    expect(roleChangePayloadFor(member({ role: 'learner' }), 'leader').role).toBe('leader');
  });
});

describe('roleChangeIsRedundant', () => {
  it('is redundant when the member already holds the role', () => {
    expect(roleChangeIsRedundant(member({ role: 'leader' }), 'leader')).toBe(true);
  });

  it('is not redundant for a real change', () => {
    expect(roleChangeIsRedundant(member({ role: 'learner' }), 'leader')).toBe(false);
  });
});

describe('canResendInvitation', () => {
  it('offers a resend only for a still-pending invitation', () => {
    expect(canResendInvitation(member({ status: 'pending' }))).toBe(true);
  });

  it.each(['active', 'inactive', 'expired'] as const)('does not offer it for %s', (status) => {
    // re-invite 400s with "User is not in pending status" for all three.
    expect(canResendInvitation(member({ status }))).toBe(false);
  });
});

describe('memberLabel', () => {
  it('names the member so a confirmation cannot be about the wrong row', () => {
    expect(memberLabel(member())).toBe('Ada Learner');
  });

  it('falls back to the username, then the email', () => {
    expect(memberLabel(member({ user: { ...member().user, firstName: '', lastName: '' } }))).toBe(
      'a.learner',
    );
    expect(
      memberLabel(
        member({ user: { ...member().user, firstName: '', lastName: '', userName: '' } }),
      ),
    ).toBe('learner@example.com');
  });
});
