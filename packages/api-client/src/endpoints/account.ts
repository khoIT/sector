import type { ApiClient } from '../client';
import {
  accountPhotoResultSchema,
  accountUserSchema,
  type AccountPhotoResult,
  type AccountUser,
  type UpdatePasswordPayload,
  type UpdateProfilePayload,
} from '../schemas/account';

/**
 * The signed-in user's own account.
 *
 * Every route here is scoped to the caller by `authUser` on the server — there
 * is no user id in any path — so none of them can read or write anyone else.
 *
 * `DELETE /api/account/delete` is now wired (see `endpoints/account-delete.ts`).
 * It was left unwired while Sector was a companion to the legacy dashboard,
 * on the reasoning that deleting an account from inside a scan vault was not
 * a flow anyone asked for. Sector now REPLACES that dashboard, so once it
 * ships there is no other door for a user who wants their account gone —
 * leaving it unreachable here would remove the only path they had.
 */

/** GET /api/account/profile. */
export async function getAccount(client: ApiClient, signal?: AbortSignal): Promise<AccountUser> {
  return client.get('/api/account/profile', { schema: accountUserSchema, signal });
}

/** PUT /api/account/profile — answers the updated user. */
export async function updateAccountProfile(
  client: ApiClient,
  payload: UpdateProfilePayload,
  signal?: AbortSignal,
): Promise<AccountUser> {
  return client.put('/api/account/profile', {
    body: payload,
    schema: accountUserSchema,
    signal,
  });
}

/**
 * PUT /api/account/password.
 *
 * Answers a bare success message with no body. The handler hashes and saves
 * and does nothing else — verified in `account.controller.ts` — so the bearer
 * token is NOT rotated and the session survives the change. Do not sign the
 * user out afterwards.
 */
export async function updateAccountPassword(
  client: ApiClient,
  payload: UpdatePasswordPayload,
  signal?: AbortSignal,
): Promise<void> {
  await client.put('/api/account/password', { body: payload, signal });
}

/**
 * POST /api/account/photo — multipart, field name `file`.
 *
 * The server's `imageFilter` rejects anything that is not an image, and the
 * old object is deleted from S3 once the new one lands. The client sets no
 * Content-Type for FormData so the browser writes its own multipart boundary.
 */
export async function uploadAccountPhoto(
  client: ApiClient,
  file: File,
  signal?: AbortSignal,
): Promise<AccountPhotoResult> {
  const body = new FormData();
  body.append('file', file);

  return client.post('/api/account/photo', {
    body,
    schema: accountPhotoResultSchema,
    signal,
  });
}

/**
 * DELETE /api/account/photo.
 *
 * Restores the shared default avatar rather than clearing the field, so the
 * response's `url` is the placeholder every account without a photo gets.
 */
export async function removeAccountPhoto(client: ApiClient, signal?: AbortSignal): Promise<void> {
  await client.del('/api/account/photo', { signal });
}
