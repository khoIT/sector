import { z } from 'zod';

/**
 * The three-step OTP password recovery flow.
 *
 * This is NOT a magic-link reset: `auth.controller.ts` issues a "primary" JWT
 * from `/send-otp`, exchanges it plus the emailed code for a "secondary" JWT
 * from `/verify-otp`, and only the secondary JWT is accepted by `/reset`. Each
 * token is single-purpose — the server checks it against the matching field on
 * the stored `UserOtp` document — so the two cannot be swapped.
 *
 * Every route here answers the SAME generic message for a bad or expired token
 * or code: `"Invalid OTP Code! OTP might already used or expired."`. That is
 * deliberate on the server's part (it is also the answer for a token whose
 * user id no longer resolves), so the client shows it verbatim rather than
 * inventing a more specific one that would claim to know something it does not.
 */

export const forgotPasswordPayloadSchema = z.object({
  email: z.string().email('Enter a valid email address').trim(),
});

export type ForgotPasswordPayload = z.infer<typeof forgotPasswordPayloadSchema>;

/**
 * POST /api/forgot-password/send-otp answers `{ email, token }` where `token`
 * is the primary JWT. On an unknown address the server throws 400 "Email not
 * found" and sends no body at all — the caller never sees this shape in that
 * case, which is exactly why the non-disclosure decision has to live at the
 * call site rather than in this schema.
 */
export const forgotPasswordResultSchema = z.object({
  email: z.string(),
  token: z.string(),
});

export type ForgotPasswordResult = z.infer<typeof forgotPasswordResultSchema>;

export const verifyForgotPasswordOtpPayloadSchema = z.object({
  token: z.string().min(1, 'The reset link is missing its token'),
  otpCode: z.string().trim().min(1, 'Enter the code from your email'),
});

export type VerifyForgotPasswordOtpPayload = z.infer<typeof verifyForgotPasswordOtpPayloadSchema>;

/** POST /api/forgot-password/verify-otp answers `{ email, token }`, this time the secondary JWT. */
export const verifyForgotPasswordOtpResultSchema = z.object({
  email: z.string(),
  token: z.string(),
});

export type VerifyForgotPasswordOtpResult = z.infer<typeof verifyForgotPasswordOtpResultSchema>;

/**
 * POST /api/forgot-password/reset. Mirrors `resetPasswordSchema` in
 * `auth.schema.ts` exactly: 8-character minimum, and `confirmPassword` is sent
 * (not just checked locally) because the server refines on it too.
 */
export const resetPasswordPayloadSchema = z
  .object({
    token: z.string().min(1, 'The reset link is missing its token'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordPayload = z.infer<typeof resetPasswordPayloadSchema>;
