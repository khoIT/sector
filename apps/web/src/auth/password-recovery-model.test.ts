import { ApiError } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import {
  buildResetPath,
  buildVerifyPath,
  classifyAuthRequestError,
  classifySendOtpError,
  parseRecoveryQuery,
  readStoredRecoveryToken,
  validateForgotPasswordEmail,
  validateResetPassword,
  writeStoredRecoveryToken,
} from './password-recovery-model';

/** A tiny in-memory Storage stand-in, the same shape language-store.test.ts uses. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  };
}

describe('parseRecoveryQuery', () => {
  it('reads both params off the query string', () => {
    expect(parseRecoveryQuery('?token=abc&email=learner%40example.test')).toEqual({
      token: 'abc',
      email: 'learner@example.test',
    });
  });

  it('answers null for whatever is missing, rather than throwing', () => {
    expect(parseRecoveryQuery('')).toEqual({ token: null, email: null });
    expect(parseRecoveryQuery('?email=learner@example.test')).toEqual({
      token: null,
      email: 'learner@example.test',
    });
  });

  it('falls back to the emailed `q` alias when there is no `token`', () => {
    // admin-reset-password-otp.eta: /forgot-password/verify?q=<primary>&email=<email>
    expect(parseRecoveryQuery('?q=primary.jwt&email=learner%40example.test')).toEqual({
      token: 'primary.jwt',
      email: 'learner@example.test',
    });
  });

  it('prefers `token` over `q` when — impossibly — both are present', () => {
    expect(parseRecoveryQuery('?token=own.jwt&q=emailed.jwt').token).toBe('own.jwt');
  });

  it('reads the manage-group reset email’s shape: just `q`, no `email`', () => {
    // group-member.controller.ts sendPasswordReset: /forgot-password/reset?q=<token>&source=manage-group
    expect(parseRecoveryQuery('?q=reset.jwt&source=manage-group')).toEqual({
      token: 'reset.jwt',
      email: null,
    });
  });
});

describe('buildVerifyPath', () => {
  it('carries only the email — never a token, so the URL cannot disclose whether one exists', () => {
    expect(buildVerifyPath('learner@example.test')).toBe(
      '/forgot-password/verify?email=learner%40example.test',
    );
    expect(buildVerifyPath('nobody@example.test')).toBe(
      '/forgot-password/verify?email=nobody%40example.test',
    );
  });
});

describe('buildResetPath', () => {
  it('carries the secondary token', () => {
    expect(buildResetPath('secondary.jwt')).toBe('/forgot-password/reset?token=secondary.jwt');
  });
});

describe('readStoredRecoveryToken / writeStoredRecoveryToken', () => {
  it('round-trips a token through the same fixed key', () => {
    const storage = memoryStorage();
    writeStoredRecoveryToken(storage, 'primary.jwt');
    expect(readStoredRecoveryToken(storage)).toBe('primary.jwt');
  });

  it('clears the entry when written with null — the non-disclosure branch', () => {
    const storage = memoryStorage({ 'sector.recovery.token': 'stale.jwt' });
    writeStoredRecoveryToken(storage, null);
    expect(readStoredRecoveryToken(storage)).toBeNull();
  });

  it('answers null for a fresh tab with nothing stored, same as an expired flow', () => {
    expect(readStoredRecoveryToken(memoryStorage())).toBeNull();
  });

  it('answers null rather than throwing when storage is unavailable', () => {
    expect(readStoredRecoveryToken(undefined)).toBeNull();
    expect(() => writeStoredRecoveryToken(undefined, 'x')).not.toThrow();
  });
});

describe('classifySendOtpError — the non-disclosure boundary', () => {
  it('treats the documented 400 "Email not found" as proceed, not an error', () => {
    const error = new ApiError({ kind: 'http', statusCode: 400, message: 'Email not found' });
    expect(classifySendOtpError(error)).toBe('proceed');
  });

  it('treats every other 4xx/5xx the same way — no status leaks account existence', () => {
    const serverError = new ApiError({ kind: 'http', statusCode: 500, message: 'Internal error' });
    expect(classifySendOtpError(serverError)).toBe('proceed');
  });

  it('shows the shared auth rate limit distinctly', () => {
    const error = new ApiError({ kind: 'http', statusCode: 429, message: 'Too many requests' });
    expect(classifySendOtpError(error)).toBe('rateLimited');
  });

  it('shows a real network failure distinctly', () => {
    const error = new ApiError({ kind: 'network', message: 'Failed to fetch' });
    expect(classifySendOtpError(error)).toBe('network');
  });

  it('treats a non-ApiError throw as a network failure', () => {
    expect(classifySendOtpError(new Error('boom'))).toBe('network');
  });
});

describe('classifyAuthRequestError — verify-otp, reset, and resend', () => {
  it('lets the server’s own generic message through', () => {
    const error = new ApiError({
      kind: 'http',
      statusCode: 400,
      message: 'Invalid OTP Code! OTP might already used or expired.',
    });
    expect(classifyAuthRequestError(error)).toBe('serverMessage');
  });

  it('shows the rate limit distinctly', () => {
    const error = new ApiError({ kind: 'http', statusCode: 429, message: 'Too many requests' });
    expect(classifyAuthRequestError(error)).toBe('rateLimited');
  });

  it('shows a parse failure as a network problem, not a server message', () => {
    const error = new ApiError({ kind: 'parse', message: 'Unexpected response shape' });
    expect(classifyAuthRequestError(error)).toBe('network');
  });
});

describe('validateForgotPasswordEmail', () => {
  it('accepts a well-formed address', () => {
    expect(validateForgotPasswordEmail({ email: 'learner@example.test' })).toEqual({
      ok: true,
      value: { email: 'learner@example.test' },
    });
  });

  it('rejects a typo before it ever reaches the non-disclosure branch', () => {
    const result = validateForgotPasswordEmail({ email: 'me@gusi' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it('rejects an empty address', () => {
    expect(validateForgotPasswordEmail({ email: '' }).ok).toBe(false);
  });
});

describe('validateResetPassword', () => {
  const valid = {
    token: 'secondary.jwt',
    password: 'NewPassphrase!2026',
    confirmPassword: 'NewPassphrase!2026',
  };

  it('accepts a password the server will also accept', () => {
    expect(validateResetPassword(valid)).toEqual({ ok: true, value: valid });
  });

  it('rejects a password under 8 characters', () => {
    const result = validateResetPassword({ ...valid, password: 'short', confirmPassword: 'short' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.password).toBeTruthy();
  });

  it('rejects a mismatch on the field the user retypes', () => {
    const result = validateResetPassword({ ...valid, confirmPassword: 'Different!2026' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.confirmPassword).toBe('Passwords do not match');
  });
});
