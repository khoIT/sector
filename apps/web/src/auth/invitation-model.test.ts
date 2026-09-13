import { ApiError } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { classifyConfirmInvitationError, validateInvitationForm } from './invitation-model';

describe('validateInvitationForm', () => {
  it('accepts a valid, matching password', () => {
    const result = validateInvitationForm({
      password: 'Passphrase!2026',
      confirmPassword: 'Passphrase!2026',
    });
    expect(result).toEqual({
      ok: true,
      value: { password: 'Passphrase!2026', confirmPassword: 'Passphrase!2026' },
    });
  });

  it('rejects a password under 8 characters', () => {
    const result = validateInvitationForm({ password: 'short', confirmPassword: 'short' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.password).toBeTruthy();
  });

  it('rejects a mismatch on the confirm field', () => {
    const result = validateInvitationForm({
      password: 'Passphrase!2026',
      confirmPassword: 'Different!2026',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.confirmPassword).toBe('Passwords do not match');
  });
});

describe('classifyConfirmInvitationError', () => {
  it('lets a server HTTP error through to be shown as-is', () => {
    const error = new ApiError({
      kind: 'http',
      statusCode: 400,
      message: 'This invitation has already been processed',
    });
    expect(classifyConfirmInvitationError(error)).toBe('serverMessage');
  });

  it('treats a network failure as network, with no rate-limit case (route is unthrottled)', () => {
    expect(
      classifyConfirmInvitationError(new ApiError({ kind: 'network', message: 'offline' })),
    ).toBe('network');
    expect(classifyConfirmInvitationError(new Error('boom'))).toBe('network');
  });
});
