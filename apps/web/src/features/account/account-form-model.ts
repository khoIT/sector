import {
  updatePasswordPayloadSchema,
  updateProfilePayloadSchema,
  type UpdatePasswordPayload,
  type UpdateProfilePayload,
} from '@sector/api-client';
import type { ZodError, ZodSchema } from 'zod';

/**
 * Form validation for the account page, kept out of the components so it can
 * be tested — the web package runs vitest in a node environment with no DOM,
 * so anything in a `.tsx` file is untestable by construction.
 *
 * Client-side rules are limited to the ones the user can see the answer to:
 * do the two new passwords match, is the new one different from the old, has
 * anything actually changed. Password strength is the server's rule and is not
 * guessed here — a client that invents a policy the server does not enforce
 * rejects passwords that would have worked.
 */

export type FieldErrors<TField extends string> = Partial<Record<TField, string>>;

export type ValidationResult<TValue, TField extends string> =
  | { ok: true; value: TValue }
  | { ok: false; errors: FieldErrors<TField> };

/** First message per field, in the order zod reported them. */
function fieldErrorsOf<TField extends string>(error: ZodError): FieldErrors<TField> {
  const errors: FieldErrors<TField> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== 'string') continue;
    const key = field as TField;
    if (errors[key] === undefined) errors[key] = issue.message;
  }

  return errors;
}

function validate<TValue, TField extends string>(
  schema: ZodSchema<TValue>,
  input: unknown,
): ValidationResult<TValue, TField> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, errors: fieldErrorsOf<TField>(parsed.error) };
}

export type ProfileField = 'firstName' | 'lastName';

export function validateProfile(
  input: unknown,
): ValidationResult<UpdateProfilePayload, ProfileField> {
  return validate(updateProfilePayloadSchema, input);
}

export type PasswordField = 'oldPassword' | 'newPassword' | 'confirmNewPassword';

export function validatePassword(
  input: unknown,
): ValidationResult<UpdatePasswordPayload, PasswordField> {
  return validate(updatePasswordPayloadSchema, input);
}

/**
 * Whether the name form has anything to send.
 *
 * Compared after trimming, because the payload is trimmed before it goes: a
 * trailing space is not a change worth a request, and telling someone their
 * name was saved when nothing moved is a small lie the page does not need.
 */
export function profileChanged(
  current: { firstName?: string | null; lastName?: string | null },
  draft: { firstName: string; lastName: string },
): boolean {
  return (
    (current.firstName ?? '').trim() !== draft.firstName.trim() ||
    (current.lastName ?? '').trim() !== draft.lastName.trim()
  );
}

/** The image types the server's upload filter accepts. */
export const ACCEPTED_PHOTO_TYPES = 'image/png,image/jpeg,image/webp';

/**
 * Reject an obviously wrong file before spending an upload on it.
 *
 * The server runs its own `imageFilter` and its own size limit; this only
 * catches the two cases where a round trip would tell the user nothing they
 * could not be told instantly.
 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function photoRejectionReason(file: {
  type: string;
  size: number;
}): string | null {
  if (!file.type.startsWith('image/')) return 'Choose an image file.';
  if (file.size > MAX_PHOTO_BYTES) return 'Choose an image under 5 MB.';
  return null;
}
