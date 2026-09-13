import type { ApiClient } from '../client';
import {
  forgotPasswordResultSchema,
  verifyForgotPasswordOtpResultSchema,
  type ForgotPasswordPayload,
  type ForgotPasswordResult,
  type ResetPasswordPayload,
  type VerifyForgotPasswordOtpPayload,
  type VerifyForgotPasswordOtpResult,
} from '../schemas/password-recovery';

/**
 * The three unauthenticated password-recovery routes. All three share the
 * server's `authRateLimit` (20 requests / 15 minutes / IP) with every other
 * auth route, `/api/login` included — a burst of retries here can lock the
 * same visitor out of signing back in.
 */

/** POST /api/forgot-password/send-otp. */
export async function sendPasswordResetOtp(
  client: ApiClient,
  payload: ForgotPasswordPayload,
): Promise<ForgotPasswordResult> {
  return client.post('/api/forgot-password/send-otp', {
    body: payload,
    schema: forgotPasswordResultSchema,
    requireAuth: false,
  });
}

/** POST /api/forgot-password/verify-otp. */
export async function verifyPasswordResetOtp(
  client: ApiClient,
  payload: VerifyForgotPasswordOtpPayload,
): Promise<VerifyForgotPasswordOtpResult> {
  return client.post('/api/forgot-password/verify-otp', {
    body: payload,
    schema: verifyForgotPasswordOtpResultSchema,
    requireAuth: false,
  });
}

/** POST /api/forgot-password/reset. Answers a bare success message, no data. */
export async function resetPassword(
  client: ApiClient,
  payload: ResetPasswordPayload,
): Promise<void> {
  await client.post('/api/forgot-password/reset', {
    body: payload,
    requireAuth: false,
  });
}
