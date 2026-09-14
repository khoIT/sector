import { z } from 'zod';

import { GROUP_TYPES } from './group';

/**
 * Create/edit group — the write side of the SAME group the scan surfaces and
 * the groups index read (`groupSchema` in `./group.ts`). Not every field the
 * server accepts is exposed here: `duration` (a course-enrolment default) and
 * `scanReviewers` (the paid/fellowship expert-review routing list) are a
 * distinct, advanced configuration surface that group administration does not
 * own — omitting them here means the server keeps whatever it already has for
 * a group, since both are optional in `updateGroupByIdSchema` too.
 *
 * `organization` is CREATE-only here as a deliberate choice, NOT because the
 * server refuses it: `updateGroupByIdSchema` does accept an optional
 * `organization`, and `updateGroupById` passes it straight through. Moving a
 * group between organizations changes who can see it and is not something the
 * edit form should offer in passing, so it is omitted. (The previous comment
 * claimed the field did not exist server-side; it does.)
 *
 * `type` is edit-only, the other way round: `createGroup` parses it and then
 * never reads it, so a create form that offered it would discard the choice.
 * See the field's own comment in `groups/forms/group-form-dialog.tsx`.
 */
export const createGroupPayloadSchema = z.object({
  organization: z.string().min(1, 'Choose an organization'),
  name: z.string().min(1, 'Name is required').max(255),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only'),
  description: z.string().max(2000).optional(),
  type: z.enum(GROUP_TYPES).optional(),
  parent: z.string().nullish(),
  isFreeTrial: z.boolean().optional(),
  expirationDate: z.string().nullish(),
  totalSeats: z.number().int().min(0).optional(),
});

export type CreateGroupPayload = z.infer<typeof createGroupPayloadSchema>;

export const updateGroupPayloadSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only')
    .optional(),
  description: z.string().max(2000).optional(),
  type: z.enum(GROUP_TYPES).optional(),
  isFreeTrial: z.boolean().optional(),
  expirationDate: z.string().nullish(),
  totalSeats: z.number().int().min(0).optional(),
});

export type UpdateGroupPayload = z.infer<typeof updateGroupPayloadSchema>;

/**
 * `POST /api/groups`, `PUT /api/groups/:id` and `GET /api/groups/:id` all
 * answer `group.toObject()`.
 *
 * Modelled against exactly the fields the edit form and the detail heading
 * read back, and no more. The response carries a great deal this client does
 * not want: verified against the mirror, `GET /api/groups/:id` for group
 * `6a6ae3d759ab84398c7cee4f` is 62 kB, of which almost all is a `members`
 * array with one entry per membership (201 of them), alongside populated
 * `author` and `parent` objects and the `courseCount`/`leaderCount`/
 * `learnerCount` virtuals. A non-strict `z.object` drops every one of them,
 * so the surface reads five fields off a payload the route insists on
 * sending. Trimming that payload is an API-side change, noted rather than
 * worked around here.
 *
 * (An earlier version of this comment said `parent` comes back as a bare id
 * and that reusing `groupSchema` would therefore throw. It does not — the
 * route populates `parent` to `{id, name, slug, totalSeats}`. The narrow
 * schema is still the right shape for a write result; the reason given for it
 * was simply wrong.)
 */
export const groupWriteResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullish(),
  type: z.enum(GROUP_TYPES).optional(),
  totalSeats: z.number().nullish(),
  isFreeTrial: z.boolean().nullish(),
  expirationDate: z.string().nullable().optional(),
});

export type GroupWriteResult = z.infer<typeof groupWriteResultSchema>;
