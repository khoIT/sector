import { ApiError } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import {
  buildResetPath,
  buildVerifyPath,
  classifyAuthRequestError,
  classifySendOtpError,
  parseRecoveryQuery,
  validateResetPassword,
} from './password-recovery-model';

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
});

describe('buildVerifyPath', () => {
  it('carries a real token', () => {
    const path = buildVerifyPath('learner@example.test', 'primary.jwt');
    expect(path).toBe('/forgot-password/verify?email=learner%40example.test&token=primary.jwt');
  });

  it('omits the token param for an unknown address — same URL shape either way', () => {
    const path = buildVerifyPath('nobody@example.test', null);
    expect(path).toBe('/forgot-password/verify?email=nobody%40example.test');
    expect(path).not.toContain('token=');
  });
});

describe('buildResetPath', () => {
  it('carries the secondary token', () => {
    expect(buildResetPath('secondary.jwt')).toBe('/forgot-password/reset?token=secondary.jwt');
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
