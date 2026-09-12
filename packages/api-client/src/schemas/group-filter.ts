import { z } from 'zod';

/**
 * Group options for a list filter — `GET /api/groups/filter-options`.
 *
 * Deliberately NOT the same source as `/api/scan/user-groups`. That one answers
 * with the caller's own memberships, which is the wrong set twice over: an
 * administrator who sees every scan has almost no memberships (two Superadmin
 * accounts on the local database have one and zero, against 1,476 groups), and
 * a scoped leader's memberships are a SUPERSET of the groups they lead, so a
 * group they belong to but do not lead filters the queue down to nothing with
 * no explanation.
 *
 * This route returns what the caller may actually filter by: every group for a
 * full-access role, led groups plus their descendants otherwise. It is
 * keyword-searchable and paged, because the unscoped answer is large.
 */

export const groupFilterOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type GroupFilterOption = z.infer<typeof groupFilterOptionSchema>;

export const groupFilterOptionsPageSchema = z.object({
  page: z.number(),
  totalPages: z.number(),
  totalItems: z.number(),
  limit: z.number(),
  items: z.array(groupFilterOptionSchema).default([]),
});

export type GroupFilterOptionsPage = z.infer<typeof groupFilterOptionsPageSchema>;
