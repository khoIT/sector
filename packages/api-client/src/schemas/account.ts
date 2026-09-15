import { z } from 'zod';

import { authRoleSchema } from './auth';

/**
 * The four account routes, all of which predate this app and none of which the
 * legacy dashboard's scan surfaces used.
 *
 * ## Why the read shape is not `authUserSchema`
 *
 * `GET /api/account/profile` and `PUT /api/account/profile` return a user with
 * `lastLoginAt` and a `profile` object that the login response does not carry,
 * and they omit `stripeCustomerId` that it does. Verified against the live
 * local API on 12 Sep. Reusing `authUserSchema` would reject the difference in
 * one direction and lose fields in the other, so the account routes get their
 * own shape and the two are merged deliberately.
 *
 * `profile` is the extended user profile — six sections of professional and
 * licensing detail. It is modelled as `unknown` here on purpose: the
 * `userprofiles` collection holds **zero documents against 3,151 users**, so
 * there is no observed payload to model, and guessing one from the server's
 * input schema would be a shape nobody has ever produced.
 */
export const accountUserSchema = z.object({
  id: z.string(),
  userName: z.string(),
  email: z.string(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  /**
   * Presigned S3 URL, and NEVER null: the server substitutes a shared default
   * avatar (`images/user.png`) for every user without one. Treat that value as
   * "no photo" — see `realPhotoUrl` in the web app.
   */
  photo: z.string().nullish(),
  role: authRoleSchema.nullish(),
  lastLoginAt: z.string().nullish(),
  /**
   * Whether the user has turned off assignment reminder email.
   *
   * `nullish` because the field did not exist until reminders did: every
   * account predating them answers with it absent, which reads as opted in.
   */
  assignmentRemindersOptOut: z.boolean().nullish(),
  profile: z.unknown().nullish(),
});

export type AccountUser = z.infer<typeof accountUserSchema>;

/**
 * What this app sends to `PUT /api/account/profile`.
 *
 * The server accepts six further sections. None is sent: they write to the
 * empty `userprofiles` collection, they are course-side concerns rather than
 * scan-vault ones, and one of them encrypts a national identity number, which
 * is not a field to start collecting as a side effect of a shell redesign.
 */
export const updateProfilePayloadSchema = z.object({
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  /**
   * Optional like the names, so the reminder toggle can send this field ALONE.
   * The server only copies across keys it finds, so a payload carrying one key
   * leaves the other two untouched rather than blanking them.
   */
  assignmentRemindersOptOut: z.boolean().optional(),
});

export type UpdateProfilePayload = z.infer<typeof updateProfilePayloadSchema>;

/**
 * `PUT /api/account/password`.
 *
 * `confirmNewPassword` is required by the server and checked there too, so it
 * is sent rather than dropped — a client that omits it gets a 400 naming a
 * field the user never saw.
 */
export const updatePasswordPayloadSchema = z
  .object({
    oldPassword: z.string().min(1, 'Your current password is required'),
    newPassword: z.string().min(1, 'A new password is required'),
    confirmNewPassword: z.string().min(1, 'Confirm the new password'),
  })
  .refine((value) => value.newPassword === value.confirmNewPassword, {
    message: 'The new passwords do not match',
    path: ['confirmNewPassword'],
  })
  .refine((value) => value.newPassword !== value.oldPassword, {
    message: 'The new password is the same as the current one',
    path: ['newPassword'],
  });

export type UpdatePasswordPayload = z.infer<typeof updatePasswordPayloadSchema>;

/** `POST /api/account/photo` answers `{ url }` — a fresh presigned URL. */
export const accountPhotoResultSchema = z.object({
  url: z.string(),
});

export type AccountPhotoResult = z.infer<typeof accountPhotoResultSchema>;

/**
 * `DELETE /api/account/delete` body. The server checks `email` against the
 * SIGNED-IN account's own email server-side and answers 400 "Email not
 * matched" on a mismatch — the typed confirmation the dialog asks for is
 * enforced twice, not just in the browser.
 */
export const deleteAccountPayloadSchema = z.object({
  email: z.string().email().trim(),
});

export type DeleteAccountPayload = z.infer<typeof deleteAccountPayloadSchema>;
