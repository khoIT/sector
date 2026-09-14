import type {
  GroupMember,
  GroupMemberRoleValue,
  UpdateGroupMemberRolePayload,
} from '@sector/api-client';

/**
 * Decisions behind the per-member actions, kept out of the cell so they are
 * testable without a DOM — same split as `forms/group-form-model.ts`.
 */

/**
 * The body for a role change.
 *
 * `expiresAt` is echoed back deliberately. `PUT /api/group-members/:id` is not
 * a partial update: its handler writes
 * `expiresAt: body.expiresAt ? new Date(body.expiresAt) : null`, so a payload
 * that omits the field CLEARS the member's expiry rather than leaving it
 * alone. See `updateGroupMemberRolePayloadSchema` for the full reasoning.
 */
export function roleChangePayloadFor(
  member: GroupMember,
  nextRole: GroupMemberRoleValue,
): UpdateGroupMemberRolePayload {
  return { role: nextRole, expiresAt: member.expiresAt ?? null };
}

/**
 * Whether a role change is worth sending at all. Selecting the role a member
 * already has is a no-op on screen but a real write on the server, and that
 * write would rewrite `expiresAt` and `updatedAt` for nothing.
 */
export function roleChangeIsRedundant(
  member: GroupMember,
  nextRole: GroupMemberRoleValue,
): boolean {
  return member.role === nextRole;
}

/**
 * Only a still-pending invitation can be resent —
 * `reInviteGroupMember` 400s with "User is not in pending status" otherwise,
 * so offering the action on an active member would be offering a known error.
 */
export function canResendInvitation(member: GroupMember): boolean {
  return member.status === 'pending';
}

/** The member's name for a confirmation prompt, falling back the way lists do. */
export function memberLabel(member: GroupMember): string {
  const full = [member.user.firstName, member.user.lastName].filter(Boolean).join(' ').trim();
  return full || member.user.userName || member.user.email;
}
