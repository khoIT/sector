import { z } from 'zod';

import { userGroupSchema } from './common';

/**
 * The full group document, for the group-administration surfaces.
 *
 * Extends `userGroupSchema` (id, name, slug, parent) rather than duplicating
 * it: `userGroupSchema` is the shape `GET /api/scan/user-groups` sends, and
 * both routes populate the SAME `Group` model, so the id/name/slug/parent
 * fields are identical on the wire. Group administration only adds the fields
 * a scan filter dropdown never needed — member/leader counts, seats and
 * expiry — rather than a second, competing group shape.
 *
 * Checked against `groupService.getAll()` (gusi_nodejs_api), which backs both
 * `GET /api/groups` and `GET /api/groups/manage`:
 *   - `type` is genuinely ABSENT (not null) on about a quarter of groups in
 *     the production mirror — it was added to the schema after those rows
 *     existed, and nothing has backfilled it. Modelled `.optional()`, not
 *     `.nullish()`, so a group with no type does not print "null".
 *   - `totalSeats` and `isFreeTrial` default to `0` / `false` at write time,
 *     so every row carries them; `.default()` here is a safety net for a
 *     pre-default legacy row rather than the expected case.
 *   - `expirationDate` is `null` by default, not absent.
 *   - `leaderCount`, `learnerCount` and `courseCount` are Mongoose COUNT
 *     virtuals (`groupSchema.virtual('leaderCount', ...)` etc.), populated on
 *     every row `groupService.getAll()` returns. They count active,
 *     non-deleted rows only.
 */
export const GROUP_TYPES = ['group', 'class'] as const;
export type GroupTypeValue = (typeof GROUP_TYPES)[number];
export const groupTypeSchema = z.enum(GROUP_TYPES);

export const groupSchema = userGroupSchema.extend({
  description: z.string().nullish(),
  type: groupTypeSchema.optional(),
  totalSeats: z.number().nullish().default(0),
  isFreeTrial: z.boolean().nullish().default(false),
  expirationDate: z.string().nullable().optional(),
  leaderCount: z.number().nullish().default(0),
  learnerCount: z.number().nullish().default(0),
  courseCount: z.number().nullish().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Group = z.infer<typeof groupSchema>;

/**
 * Permissions that make the UNSCOPED read routes (`GET /api/groups`,
 * `GET /api/group-members`) a legitimate call for OUR OWN UI to make.
 *
 * Scoping decision (verified by reading the controllers, gusi_nodejs_api):
 *   - `GET /api/groups` (group.controller.ts#getGroups) applies NO caller
 *     scoping at all — every signed-in role holding `read:group` gets every
 *     group in the system. It must never back a group leader's index.
 *   - `GET /api/groups/manage` (group/manager/manager.controller.ts#getParentGroup)
 *     scopes to `getLedGroupIdsWithDescendants(userId)` UNLESS the caller
 *     holds `admin:full-access` — the CTP-307 helper, shared with
 *     `assertLeadsGroup` below. This is the one to feed a group leader's or
 *     scan reviewer's index from.
 *   - The seeded `administrator` role carries `full-access`, not
 *     `admin:full-access` (only `superadmin` carries both — confirmed against
 *     `db.roles.find()` on the local database). `getLedGroupIdsWithDescendants`
 *     would therefore scope a plain administrator to the groups THEY
 *     personally lead — almost always none — silently hiding the rest of the
 *     system from the one role meant to see it all.
 *
 * So a caller holding either permission is routed to the unscoped-but-legitimate
 * endpoint instead; anyone else gets the server-scoped one. This is a client
 * decision, not a server fix: `GET /api/groups` still has no ownership check,
 * so this constant must never widen to a permission a group-scoped role also
 * holds, or that role could reach it by the same code path.
 *
 * The identical trade-off applies to members: `GET /api/group-members` (a
 * client-supplied `groupId`, group-member.controller.ts#getGroupMembers)
 * never calls `assertLeadsGroup`, while `GET /api/groups/manage/member/:groupId`
 * (manager.controller.ts#getGroupMembers) does. Both hooks branch on this
 * same constant.
 */
export const GROUP_ADMIN_BYPASS_PERMISSIONS = ['full-access', 'admin:full-access'] as const;
