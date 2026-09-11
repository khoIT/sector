import type { ApiClient } from '../client';
import { authSessionSchema, type AuthSession, type LoginPayload } from '../schemas/auth';

/**
 * Auth endpoints.
 *
 * There is NO bearer-authenticated "current user" route on this API. That is
 * the single most surprising thing about the auth surface, so it is spelled
 * out here: `GET /api/me` looks like one but is a refresh-token exchange — it
 * reads `?refreshToken=`, ignores the Authorization header, ROTATES the stored
 * refresh token and returns a brand-new token pair. Treat it as session
 * restore, never as a cheap "am I still logged in" ping.
 */

/**
 * POST /api/login
 *
 * The field is `userEmail` and accepts either a username or an email address.
 * The `eulaAgreement` checkbox the legacy login form sent is client-side
 * validation only — the server ignores it — so it is not part of the payload.
 *
 * Auth routes are rate-limited server-side (authRateLimit).
 */
export async function login(client: ApiClient, payload: LoginPayload): Promise<AuthSession> {
  return client.post('/api/login', {
    body: payload,
    schema: authSessionSchema,
    requireAuth: false,
  });
}

/**
 * GET /api/me?refreshToken=...
 *
 * Restores a session after a reload and hands back a FRESH token pair plus the
 * full user with populated role permissions. Rotation means the refreshToken
 * you passed is dead afterwards: persist the one that comes back, or the next
 * reload signs the user out.
 */
export async function getCurrentUser(
  client: ApiClient,
  refreshToken: string,
): Promise<AuthSession> {
  return client.get('/api/me', {
    query: { refreshToken },
    schema: authSessionSchema,
    requireAuth: false,
  });
}
