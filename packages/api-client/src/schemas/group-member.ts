import { z } from 'zod';

import { userBasicSchema } from './common';

/**
 * A group-member row, for the members surface.
 *
 * Checked against `groupMemberService.getAll()` (gusi_nodejs_api), the
 * aggregation both `GET /api/group-members` and
 * `GET /api/groups/manage/member/:groupId` run: it hand-builds the row with an
 * `$addFields`/`$project` pair rather than a Mongoose `.populate()`, but the
 * shape lands the same — `user` is projected to exactly the fields
 * `userBasicSchema` already models, so it is reused rather than duplicated.
 *
 * The nested `group` object the aggregation also returns is deliberately NOT
 * modelled here: every member row on this surface belongs to the one group
 * already named by the route's `:groupId`, so repeating it per row would only
 * be parsed and thrown away.
 */
export const GROUP_MEMBER_ROLES = ['leader', 'learner'] as const;
export type GroupMemberRoleValue = (typeof GROUP_MEMBER_ROLES)[number];
export const groupMemberRoleSchema = z.enum(GROUP_MEMBER_ROLES);

/**
 * `suspended` does not exist on this model (it is a `group-leader-management`
 * status from the legacy dashboard's separate leader screen). The real four,
 * confirmed against `db.groupmembers.aggregate([{$group:{_id:"$status"}}])`
 * on the local production mirror: `active` and `pending` are the ones seen
 * live; `inactive` and `expired` are declared on the model and reachable via
 * `PUT /api/group-members/:id`.
 */
export const GROUP_MEMBER_STATUSES = ['active', 'pending', 'inactive', 'expired'] as const;
export type GroupMemberStatusValue = (typeof GROUP_MEMBER_STATUSES)[number];
export const groupMemberStatusSchema = z.enum(GROUP_MEMBER_STATUSES);

export const groupMemberSchema = z.object({
  id: z.string(),
  user: userBasicSchema,
  role: groupMemberRoleSchema,
  status: groupMemberStatusSchema,
  /** Always set at creation (`default: Date.now`), so this is a plain string. */
  joinedAt: z.string(),
  /** Only leaders and learners added with a term carry one. */
  expiresAt: z.string().nullish(),
});

export type GroupMember = z.infer<typeof groupMemberSchema>;
