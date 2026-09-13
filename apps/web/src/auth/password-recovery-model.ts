import {
  isApiError,
  resetPasswordPayloadSchema,
  type ResetPasswordPayload,
} from '@sector/api-client';

/**
 * The parts of the three-step OTP recovery flow that do not touch the DOM —
 * the web package runs vitest in a node environment with no jsdom, so this is
 * also the only part of the flow a unit test can reach directly.
 *
 * The step tokens travel in the URL (`?token=&email=`) rather than in
 * component state, mirroring the legacy dashboard's `?q=<token>&email=` — a
 * page reload re-reads them from the address bar instead of losing the flow.
 */

const TOKEN_PARAM = 'token';
const EMAIL_PARAM = 'email';

export type RecoveryQuery = {
  token: string | null;
  email: string | null;
};

/** Read the step token and email carried between the three pages. */
export function parseRecoveryQuery(search: string): RecoveryQuery {
  const params = new URLSearchParams(search);
  return {
    token: params.get(TOKEN_PARAM),
    email: params.get(EMAIL_PARAM),
  };
}

/**
 * The "verify" page's URL. `token` is nullable: an unknown email address gets
 * no primary token from the server, and the page must reach the SAME url
 * regardless — see `classifySendOtpError` below.
 */
export function buildVerifyPath(email: string, token: string | null): string {
  const params = new URLSearchParams({ [EMAIL_PARAM]: email });
  if (token) params.set(TOKEN_PARAM, token);
  return `/forgot-password/verify?${params.toString()}`;
}

/** The "reset" page's URL, carrying the secondary token verify-otp answered. */
export function buildResetPath(token: string): string {
  return `/forgot-password/reset?${new URLSearchParams({ [TOKEN_PARAM]: token }).toString()}`;
}

export type SendOtpOutcome =
  /** Success, or the address does not exist — identically worded on purpose. */
  'proceed' | 'rateLimited' | 'network';

/**
 * `POST /api/forgot-password/send-otp` answers 400 "Email not found" for an
 * unknown address (verified in `auth.controller.ts`). Whether an account
 * exists must never be observable from the UI, so that 400 takes the exact
 * same path as a real send. Only a 429 (the shared 20-requests/15-minutes
 * auth rate limit) and a genuine network failure are shown as themselves.
 */
export function classifySendOtpError(error: unknown): SendOtpOutcome {
  if (!isApiError(error)) return 'network';
  if (error.statusCode === 429) return 'rateLimited';
  if (error.kind !== 'http') return 'network';
  return 'proceed';
}

export type AuthRequestOutcome =
  /** The server's own message is safe to show verbatim (see the two OTP
   *  routes' shared generic wording — it never confirms account existence). */
  'serverMessage' | 'rateLimited' | 'network';

/** Classify a failure from verify-otp, reset, or a resend — anything past the first, non-disclosing step. */
export function classifyAuthRequestError(error: unknown): AuthRequestOutcome {
  if (!isApiError(error)) return 'network';
  if (error.statusCode === 429) return 'rateLimited';
  if (error.kind !== 'http') return 'network';
  return 'serverMessage';
}

export type NewPasswordField = 'password' | 'confirmPassword';
export type ValidateResetPasswordResult =
  | { ok: true; value: ResetPasswordPayload }
  | { ok: false; errors: Partial<Record<NewPasswordField, string>> };

/**
 * Client-side mirror of `resetPasswordSchema` in `auth.schema.ts`: 8-character
 * minimum, and the two fields must match. Password STRENGTH beyond the length
 * floor is the server's rule and is not guessed at here.
 */
export function validateResetPassword(input: unknown): ValidateResetPasswordResult {
  const parsed = resetPasswordPayloadSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };

  const errors: Partial<Record<NewPasswordField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[issue.path.length - 1];
    if ((field === 'password' || field === 'confirmPassword') && errors[field] === undefined) {
      errors[field] = issue.message;
    }
  }
  return { ok: false, errors };
}
