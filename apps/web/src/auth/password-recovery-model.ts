import {
  forgotPasswordPayloadSchema,
  isApiError,
  resetPasswordPayloadSchema,
  type ForgotPasswordPayload,
  type ResetPasswordPayload,
} from '@sector/api-client';

/**
 * The parts of the three-step OTP recovery flow that do not touch the DOM —
 * the web package runs vitest in a node environment with no jsdom, so this is
 * also the only part of the flow a unit test can reach directly.
 */

const TOKEN_PARAM = 'token';
/**
 * Two API emails link straight into this flow and both name the token `q`:
 * `admin-reset-password-otp.eta` sends `/forgot-password/verify?q=<primary>&
 * email=<email>`, and the manage-group reset link in
 * `group-member.controller.ts` sends `/forgot-password/reset?q=<token>&
 * source=manage-group` (there the primary and secondary tokens are issued
 * identically, so `/api/forgot-password/reset` accepts it directly, with no
 * OTP step). `token` is checked first so it never collides with `q`: this
 * app's own navigation never sets `q`, and an emailed link never sets `token`.
 */
const LEGACY_TOKEN_PARAM = 'q';
const EMAIL_PARAM = 'email';

export type RecoveryQuery = {
  token: string | null;
  email: string | null;
};

/** Read the step token (or its emailed `q` alias) and the email off the URL. */
export function parseRecoveryQuery(search: string): RecoveryQuery {
  const params = new URLSearchParams(search);
  return {
    token: params.get(TOKEN_PARAM) ?? params.get(LEGACY_TOKEN_PARAM),
    email: params.get(EMAIL_PARAM),
  };
}

/**
 * Where this app's OWN in-app step token lives between forgot and verify.
 * Exported so `storage-migration.test.ts` can account for it: it is a
 * sessionStorage key, not a localStorage one, so it has no entry in
 * `PERSISTED_KEYS` and nothing to carry over from the pre-Sector name —
 * sessionStorage never existed under the legacy dashboard's product name.
 */
export const STEP_TOKEN_STORAGE_KEY = 'sector.recovery.token';

/**
 * The in-app step token lives in sessionStorage, not the URL.
 *
 * An earlier version of this flow put the token in the URL only when the
 * typed address matched a real account, which made the ADDRESS BAR itself
 * the disclosure — an attacker never has to read the page, only whether
 * `token=` is present after submitting. sessionStorage carries the same
 * value across a reload in the same tab (what the URL was doing before,
 * minus the leak); a fresh tab starts with none, which is indistinguishable
 * from "the flow expired" and is the correct thing for it to look like.
 * Guarded the same way `language-store.ts` guards `localStorage`: a private
 * window with storage blocked costs this flow its reload continuity, not
 * correctness.
 */
export function readStoredRecoveryToken(
  storage: Pick<Storage, 'getItem'> | undefined,
): string | null {
  try {
    return storage?.getItem(STEP_TOKEN_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeStoredRecoveryToken(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined,
  token: string | null,
): void {
  try {
    if (token) storage?.setItem(STEP_TOKEN_STORAGE_KEY, token);
    else storage?.removeItem(STEP_TOKEN_STORAGE_KEY);
  } catch {
    // Falls through to the "start again" state on the verify page.
  }
}

/**
 * The "verify" page's URL. Carries ONLY the email, on purpose: whether a
 * primary token exists is exactly the fact this flow must not leak, and the
 * previous token-in-the-URL design leaked it through the URL's own shape.
 * See `readStoredRecoveryToken` for where the token actually goes.
 */
export function buildVerifyPath(email: string): string {
  return `/forgot-password/verify?${new URLSearchParams({ [EMAIL_PARAM]: email }).toString()}`;
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

export type EmailField = 'email';
export type ValidateForgotPasswordEmailResult =
  { ok: true; value: ForgotPasswordPayload } | { ok: false; error: string };

/**
 * Client-side mirror of `forgotPasswordSchema` in `auth.schema.ts`.
 *
 * Without this, a typo like `me@gusi` reaches the server, which answers 400
 * "Email not found" — the SAME response an unknown-but-well-formed address
 * gets — and the visitor sees "check your email" for an address that could
 * never have received anything. Catching the malformed case here, before the
 * non-disclosure branch ever runs, is not a disclosure risk: a validation
 * error says nothing about whether any particular address has an account.
 */
export function validateForgotPasswordEmail(input: unknown): ValidateForgotPasswordEmailResult {
  const parsed = forgotPasswordPayloadSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: parsed.error.issues[0]?.message ?? 'Enter a valid email address' };
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
