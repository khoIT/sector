import {
  createGroupPayloadSchema,
  updateGroupPayloadSchema,
  type CreateGroupPayload,
  type GroupTypeValue,
  type GroupWriteResult,
  type UpdateGroupPayload,
} from '@sector/api-client';
import type { ZodError } from 'zod';

/**
 * Group create/edit form logic, kept out of the dialog component so it is
 * testable without rendering anything — the web package runs vitest in a
 * node environment with no DOM (see `account-form-model.ts` for the same
 * split on the account page).
 */

export type GroupFormDraft = {
  organization: string;
  name: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  type: GroupTypeValue | '';
  totalSeats: string;
  isFreeTrial: boolean;
  expirationDate: string;
};

export const EMPTY_GROUP_DRAFT: GroupFormDraft = {
  organization: '',
  name: '',
  slug: '',
  slugTouched: false,
  description: '',
  type: '',
  totalSeats: '',
  isFreeTrial: false,
  expirationDate: '',
};

/** A group's own fields, as a starting draft for the edit form. */
export function draftFromGroup(group: GroupWriteResult): GroupFormDraft {
  return {
    organization: '',
    name: group.name,
    slug: group.slug,
    slugTouched: true,
    description: group.description ?? '',
    type: group.type ?? '',
    totalSeats: group.totalSeats ? String(group.totalSeats) : '',
    isFreeTrial: group.isFreeTrial ?? false,
    expirationDate: group.expirationDate ? group.expirationDate.slice(0, 10) : '',
  };
}

/**
 * A URL-safe slug from a name: lowercase, non-alphanumerics collapsed to a
 * single hyphen, no leading/trailing hyphen. Only applied while the user has
 * not typed their own slug — see `slugTouched`.
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type FieldErrors<TField extends string> = Partial<Record<TField, string>>;
export type ValidationResult<TValue, TField extends string> =
  { ok: true; value: TValue } | { ok: false; errors: FieldErrors<TField> };

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

export type GroupField =
  'organization' | 'name' | 'slug' | 'description' | 'type' | 'totalSeats' | 'expirationDate';

function toPayload(draft: GroupFormDraft): Record<string, unknown> {
  return {
    organization: draft.organization || undefined,
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    description: draft.description.trim() || undefined,
    type: draft.type || undefined,
    totalSeats: draft.totalSeats.trim() ? Number(draft.totalSeats) : undefined,
    isFreeTrial: draft.isFreeTrial,
    expirationDate: draft.expirationDate || undefined,
  };
}

export function validateCreateGroup(
  draft: GroupFormDraft,
): ValidationResult<CreateGroupPayload, GroupField> {
  const parsed = createGroupPayloadSchema.safeParse(toPayload(draft));
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, errors: fieldErrorsOf<GroupField>(parsed.error) };
}

export function validateUpdateGroup(
  draft: GroupFormDraft,
): ValidationResult<UpdateGroupPayload, GroupField> {
  const { organization: _organization, ...payload } = toPayload(draft);
  const parsed = updateGroupPayloadSchema.safeParse(payload);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, errors: fieldErrorsOf<GroupField>(parsed.error) };
}
