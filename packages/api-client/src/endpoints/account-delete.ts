import type { ApiClient } from '../client';
import type { DeleteAccountPayload } from '../schemas/account';

/**
 * DELETE /api/account/delete.
 *
 * `deleteAccount` in `account.controller.ts` SOFT-deletes: it sets
 * `status: 'deleted'`, stamps `deletedAt`, and suffixes `userName`/`email`
 * with `_deleted_<timestamp>` so the address can be reused. It does NOT touch
 * the user's scans, reviews or group memberships — those rows keep pointing
 * at this user id forever. Any confirmation copy shown before calling this
 * must say that, not "all your data is removed".
 */
export async function deleteAccount(
  client: ApiClient,
  payload: DeleteAccountPayload,
): Promise<void> {
  await client.del('/api/account/delete', { body: payload });
}
