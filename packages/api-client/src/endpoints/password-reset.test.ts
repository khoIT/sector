import { describe, expect, it, vi } from 'vitest';

import { createClient } from '../client';
import { isApiError } from '../errors';
import { resetPassword, sendPasswordResetOtp, verifyPasswordResetOtp } from './password-reset';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Fixtures shaped exactly like `auth.controller.ts`'s `sendResponse` calls for
 * these three routes, not guessed at — see forgotPassword,
 * verifyForgotPasswordOtp and resetPassword.
 */
describe('sendPasswordResetOtp', () => {
  it('posts to send-otp without auth and parses {email, token}', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        statusCode: 200,
        status: 'success',
        message: 'Successfully sent a reset password OTP code to your email',
        data: { email: 'learner@example.test', token: 'primary.jwt.token' },
      }),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await sendPasswordResetOtp(client, { email: 'learner@example.test' });
    expect(result).toEqual({ email: 'learner@example.test', token: 'primary.jwt.token' });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe('/api/forgot-password/send-otp');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('surfaces the server’s 400 "Email not found" as an ApiError — the caller decides whether to disclose it', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 400, status: 'error', message: 'Email not found' }, 400),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(sendPasswordResetOtp(client, { email: 'nobody@example.test' })).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.statusCode === 400,
    );
  });
});

describe('verifyPasswordResetOtp', () => {
  it('parses {email, token} — the secondary token this time', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        statusCode: 200,
        status: 'success',
        message: 'OTP Code for reset password verified successfully',
        data: { email: 'learner@example.test', token: 'secondary.jwt.token' },
      }),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await verifyPasswordResetOtp(client, {
      token: 'primary.jwt.token',
      otpCode: '123456',
    });
    expect(result.token).toBe('secondary.jwt.token');
  });

  it('carries the server’s generic message on a wrong or expired code', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(
        {
          statusCode: 400,
          status: 'error',
          message: 'Invalid OTP Code! OTP might already used or expired.',
        },
        400,
      ),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(
      verifyPasswordResetOtp(client, { token: 't', otpCode: '000000' }),
    ).rejects.toMatchObject({ message: 'Invalid OTP Code! OTP might already used or expired.' });
  });
});

describe('resetPassword', () => {
  it('posts token + password and resolves void on the bare success envelope', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 200, status: 'success', message: 'Password reset successfully' }),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(
      resetPassword(client, {
        token: 'secondary.jwt.token',
        password: 'NewPassphrase!2026',
        confirmPassword: 'NewPassphrase!2026',
      }),
    ).resolves.toBeUndefined();

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe('/api/forgot-password/reset');
    expect(JSON.parse(init.body as string)).toEqual({
      token: 'secondary.jwt.token',
      password: 'NewPassphrase!2026',
      confirmPassword: 'NewPassphrase!2026',
    });
  });
});
