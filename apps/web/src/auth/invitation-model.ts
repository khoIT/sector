import { isApiError } from '@sector/api-client';
import { z } from 'zod';

/**
 * Validation for the group-invitation landing page.
 *
 * `confirmGroupInvitationPayloadSchema` in the api-client only models what the
 * SERVER checks — `token` and an 8-character `password` — because the server
 * never sees `confirmPassword`. The match check belongs entirely here.
 */

const invitationFormSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type InvitationField = 'password' | 'confirmPassword';
export type ValidateInvitationResult =
  | { ok: true; value: { password: string; confirmPassword: string } }
  | { ok: false; errors: Partial<Record<InvitationField, string>> };

export function validateInvitationForm(input: unknown): ValidateInvitationResult {
  const parsed = invitationFormSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };

  const errors: Partial<Record<InvitationField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[issue.path.length - 1];
    if ((field === 'password' || field === 'confirmPassword') && errors[field] === undefined) {
      errors[field] = issue.message;
    }
  }
  return { ok: false, errors };
}

export type ConfirmInvitationOutcome = 'serverMessage' | 'network';

/**
 * The confirm-invitation route carries no rate limit of its own (it is not
 * behind `authRateLimit` — see `group-member.route.ts`), so unlike the
 * password-recovery flow there is no 429 case to special-case here.
 */
export function classifyConfirmInvitationError(error: unknown): ConfirmInvitationOutcome {
  if (isApiError(error) && error.kind === 'http') return 'serverMessage';
  return 'network';
}
