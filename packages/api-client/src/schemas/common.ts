import { z } from 'zod';

/**
 * Shapes shared by more than one domain.
 *
 * Every schema here was checked against live responses from the local API
 * (gusi_dev, 31k scans) rather than copied from the legacy client, because the
 * legacy Zod objects were never `.parse()`d and had drifted from the wire.
 */

/**
 * The populated-user stub the API embeds everywhere.
 * firstName/lastName come back as '' for many real users, and are absent on
 * some routes, so both are optional and nullable.
 */
export const userBasicSchema = z.object({
  id: z.string(),
  userName: z.string(),
  email: z.string(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
});

export type UserBasic = z.infer<typeof userBasicSchema>;

/** Display name with a sensible fallback chain. */
export function userDisplayName(user: UserBasic): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || user.userName || user.email;
}

export const fileStatusSchema = z.enum(['pending', 'completed', 'failed']);
export type FileStatusValue = z.infer<typeof fileStatusSchema>;

/**
 * A scan file enriched with CloudFront-presigned media URLs.
 *
 * `url` is nullable, not required: when a scan has no real File documents the
 * detail route substitutes the `pendingFiles` snapshot with synthetic ids
 * (`pending-0`, `pending-1`, ...) and every url field null, so the UI can show
 * real filenames after a failed or partial upload. Use
 * `isPendingFilePlaceholder()` to tell the two apart.
 *
 * These URLs are presigned and EXPIRE. Never persist them.
 */
export const mediaFileSchema = z.object({
  id: z.string(),
  filename: z.string(),
  filesize: z.number(),
  filetype: z.string(),
  filepath: z.string(),
  status: fileStatusSchema.nullish(),
  url: z.string().nullable(),
  urlThumbnail: z.string().nullable(),
  url360: z.string().nullable(),
  url480: z.string().nullable(),
  url720: z.string().nullable(),
});

export type MediaFile = z.infer<typeof mediaFileSchema>;

/** True for a synthetic entry standing in for a file that never landed. */
export function isPendingFilePlaceholder(file: { id: string }): boolean {
  return file.id.startsWith('pending-');
}

/**
 * Group reference attached to a scan.
 *
 * Verified drift: the LIST routes send `{ _id, name }` while the DETAIL routes
 * send `{ id, name }`. The legacy client typed this as the full GroupSchema,
 * which matched neither. The transform normalises both onto `{ id, name }`.
 */
export const scanGroupRefSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    name: z.string(),
  })
  .transform((group) => ({
    id: group.id ?? group._id ?? '',
    name: group.name,
  }));

export type ScanGroupRef = z.infer<typeof scanGroupRefSchema>;

/**
 * The `groups` array as a scan route sends it.
 *
 * VERIFIED SHAPE (production mirror through the running API, 13 Sep 2026):
 * the DETAIL route resolves a scan's groups one scan at a time and keeps the
 * null that populate leaves for a group that has since been soft-deleted —
 * ten sampled details out of a thousand carried `[null, null]`. The LIST
 * mapper filters those out before answering. One schema serves both routes,
 * so it drops the nulls itself: a group that no longer exists is not a
 * destination the study went to, and it is not a reason to blank the page.
 */
export const scanGroupListSchema = z
  .array(scanGroupRefSchema.nullable())
  .transform((groups) => groups.filter((group): group is ScanGroupRef => group !== null));

/**
 * Caller's groups from GET /api/scan/user-groups — the group filter source,
 * and the only scan route with no permission guard (authUser only).
 */
export const userGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  parent: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    })
    .nullable(),
});

export type UserGroup = z.infer<typeof userGroupSchema>;
