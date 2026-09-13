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
 * `organization` is CREATE-only: `updateGroupByIdSchema` (gusi_nodejs_api) has
 * no `organization` field, so a group cannot be moved to a different
 * organization after creation from this client, matching the server.
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
 * `POST /api/groups`, `PUT /api/groups/:id` AND `GET /api/groups/:id` all
 * answer `group.toObject()` — the plain document, without the
 * `leaderCount`/`learnerCount`/`courseCount` aggregation `groupService.getAll()`
 * adds for the index (see the doc comment on `groupSchema`). One schema for
 * all three rather than reusing `groupSchema`: `parent` on a plain
 * `toObject()` is a bare id, not the populated `{id,name,slug}` shape
 * `userGroupSchema` requires, so parsing this response with the full read
 * schema would throw on any group that has one. Modelled against exactly the
 * fields the edit form reads back (it does not need `parent`, so that field
 * is dropped rather than mistyped).
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
