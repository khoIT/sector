import type { ApiClient } from '../client';
import {
  confirmGroupInvitationResultSchema,
  type ConfirmGroupInvitationPayload,
  type ConfirmGroupInvitationResult,
} from '../schemas/invitation';

/**
 * POST /api/group-members/confirm-invitation. Unauthenticated — the route
 * carries no `authUser` middleware, because the person calling it does not
 * have a session yet.
 */
export async function confirmGroupInvitation(
  client: ApiClient,
  payload: ConfirmGroupInvitationPayload,
): Promise<ConfirmGroupInvitationResult> {
  return client.post('/api/group-members/confirm-invitation', {
    body: payload,
    schema: confirmGroupInvitationResultSchema,
    requireAuth: false,
  });
}
