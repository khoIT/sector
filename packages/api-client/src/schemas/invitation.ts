import { z } from 'zod';

/**
 * The unauthenticated group-invitation landing route.
 *
 * The invitation email links to `/group-invitation-confirmation?token=...`
 * (see `mail.groupInvitation` / `mail.onboardUser` call sites in
 * `group-member.controller.ts`). The token is a JWT carrying only
 * `{ userId, groupMemberId, action }` — no group name, no inviter — so there
 * is no unauthenticated route this client can call to show which group
 * invited the user before they set a password. Do not invent one.
 */

export const confirmGroupInvitationPayloadSchema = z.object({
  token: z.string().min(1, 'The invitation link is missing its token'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export type ConfirmGroupInvitationPayload = z.infer<typeof confirmGroupInvitationPayloadSchema>;

/** POST /api/group-members/confirm-invitation success shape. */
export const confirmGroupInvitationResultSchema = z.object({
  userId: z.string(),
  groupMemberId: z.string(),
  groupId: z.string(),
});

export type ConfirmGroupInvitationResult = z.infer<typeof confirmGroupInvitationResultSchema>;
