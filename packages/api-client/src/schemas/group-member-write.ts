import { z } from 'zod';

import { groupMemberRoleSchema } from './group-member';

/**
 * The write side of group membership — all five routes live under
 * `/api/group-members` (`group-member.controller.ts`, gusi_nodejs_api), each
 * gated by its own `create|edit|delete:group-member` permission. Deliberately
 * NOT the redundant `POST/DELETE /api/groups/manage/member/:groupId` pair:
 * those take only an existing `userId` (no email invite), carry no
 * permission gate at all (`authUser` only, scoped by `assertLeadsGroup`), and
 * would be a second code path to the same effect. One family, not two.
 */
export const inviteGroupMemberPayloadSchema = z.object({
  groupId: z.string().min(1),
  email: z.string().trim().email('Enter a valid email address'),
  role: groupMemberRoleSchema,
  firstName: z.string().trim().max(255).optional(),
  lastName: z.string().trim().max(255).optional(),
});

export type InviteGroupMemberPayload = z.infer<typeof inviteGroupMemberPayloadSchema>;

/**
 * `POST /api/group-members/invite` answers `{ ...groupMember.toObject(),
 * isNewUser }`. Only `isNewUser` is modelled: it is the one field the caller
 * needs to pick the right success message ("account created" vs "added to
 * group"), and the created membership itself is proved by the `groupmembers`
 * fidelity entry, not by this echoed, unpopulated document.
 */
export const inviteGroupMemberResultSchema = z.object({
  isNewUser: z.boolean(),
});

export type InviteGroupMemberResult = z.infer<typeof inviteGroupMemberResultSchema>;

/**
 * `POST /api/group-members/invite` 400s with `code: 'USER_ALREADY_EXISTS'`
 * when the email already belongs to an active account — the error message
 * itself asks "Do you want to proceed to add this user to the group?", which
 * is exactly this route. `emailUserName` accepts either an email or a
 * username (`addUserToGroupSchema`, gusi_nodejs_api).
 */
export const addExistingUserToGroupPayloadSchema = z.object({
  groupId: z.string().min(1),
  emailUserName: z.string().trim().min(1, 'Enter an email or username'),
  role: groupMemberRoleSchema,
});

export type AddExistingUserToGroupPayload = z.infer<typeof addExistingUserToGroupPayloadSchema>;

/** `POST /api/group-members/re-invite` — only for a still-`pending` member. */
export const reInviteGroupMemberPayloadSchema = z.object({
  groupId: z.string().min(1),
  email: z.string().trim().email(),
});

export type ReInviteGroupMemberPayload = z.infer<typeof reInviteGroupMemberPayloadSchema>;

/**
 * `PUT /api/group-members/:id` body. `status` is intentionally not exposed
 * here: the four values (`active`/`pending`/`inactive`/`expired`) are mostly
 * system-managed (invitation acceptance, expiry), and the one member-facing
 * action this form needs — leaving the group — already has its own route
 * (`DELETE /api/group-members/:id`).
 *
 * `expiresAt` IS required in the payload, and callers must echo the member's
 * current value, because the handler does not treat this as a partial update:
 *
 *   expiresAt: body.expiresAt ? new Date(body.expiresAt) : null
 *
 * Mongoose strips `undefined` from a `findOneAndUpdate`, but that expression
 * yields an explicit `null`, which is written. So omitting the field clears
 * the member's expiry instead of leaving it alone — silently converting a
 * time-limited membership into a permanent one. 500 `groupmembers` rows on
 * the production mirror hold a real `expiresAt` date. The proper fix is
 * server-side; echoing the current value is what this client can do without
 * it, and `groupMemberSchema.expiresAt` already carries the value to echo.
 */
export const updateGroupMemberRolePayloadSchema = z.object({
  role: groupMemberRoleSchema,
  expiresAt: z.string().nullish(),
});

export type UpdateGroupMemberRolePayload = z.infer<typeof updateGroupMemberRolePayloadSchema>;
