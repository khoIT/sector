import { z } from 'zod';

/**
 * Auth shapes, verified against the live local API.
 *
 * Note the login route's field name: `userEmail`, not `email`. It accepts
 * either a username or an email address in that one field.
 */

export const loginPayloadSchema = z.object({
  userEmail: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginPayload = z.infer<typeof loginPayloadSchema>;

/**
 * `permissions` drives every route guard on the server and every tab in the
 * UI. Known scan-related values: view:scan, read:scan, create:scan, edit:scan,
 * delete:scan, view:scan:pending[:group], view:scan:reviewed[:group],
 * view:scan:pending:expert[:group], view:scan:reviewed:expert[:group],
 * create:scan:review, create/read/delete:scan:note.
 */
export const authRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  permissions: z.array(z.string()).default([]),
});

export type AuthRole = z.infer<typeof authRoleSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  userName: z.string(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  /** Presigned S3 URL. Expires; do not persist it beyond the session. */
  photo: z.string().nullish(),
  stripeCustomerId: z.string().nullish(),
  role: authRoleSchema,
});

export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * What POST /api/login and GET /api/me return.
 *
 * `token` is the long-lived bearer used for every request (7 days). The route
 * ALSO returns a short-lived `accessToken` (15m) and a `refreshToken` (30d)
 * that the legacy dashboard ignored entirely. We keep the refreshToken because
 * it is the only way to restore a session: see the note on getCurrentUser.
 */
export const authSessionSchema = z.object({
  token: z.string(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.string().optional(),
  refreshTokenExpiresIn: z.string().optional(),
  user: authUserSchema,
});

export type AuthSession = z.infer<typeof authSessionSchema>;

/** True when the role carries every permission asked for. */
export function hasPermission(
  user: Pick<AuthUser, 'role'> | null | undefined,
  required: string | string[],
): boolean {
  if (!user) return false;
  const needed = Array.isArray(required) ? required : [required];
  if (needed.length === 0) return true;
  const granted = new Set(user.role.permissions);
  return needed.every((permission) => granted.has(permission));
}

/** True when the role carries at least one of the permissions asked for. */
export function hasAnyPermission(
  user: Pick<AuthUser, 'role'> | null | undefined,
  required: string[],
): boolean {
  if (!user) return false;
  if (required.length === 0) return true;
  const granted = new Set(user.role.permissions);
  return required.some((permission) => granted.has(permission));
}
