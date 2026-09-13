import { z } from 'zod';

/**
 * The pathology gallery: a category bar, a sub-category rail, and a card grid
 * with a clip in a dialog. Three read-only routes, no permissions, no writes.
 *
 * `category` / `subCategory` on the stored document are free text with no
 * reference to ScanType — the legacy server guessed the scan type by
 * lowercasing names and the legacy client hid anything it guessed wrong
 * behind a hardcoded 13-name whitelist. `scanTypeId` is the real relation the
 * API now carries (see the API repo's `pathology-gallery.model.ts`), and the
 * category bar below is served from it. There is no client-side whitelist
 * here — every category the server returns is rendered, including one whose
 * `id` is null because it names no scan type (a retired third-party product,
 * or a name still awaiting a clinical decision). Hiding those silently is
 * exactly the defect this schema and its caller exist to not repeat.
 */

/**
 * GET /api/pathology-gallery/categories.
 *
 * `id: null` means an unmapped legacy category — shown, not dropped.
 * Verified against the local production mirror, 2026-09-14, after the
 * scanTypeId backfill (1,288 of 1,305 published items mapped; the 17 that do
 * not are exactly `FAST/EFAST` and `Rapid Reviews`, both intentionally left
 * unmapped pending a clinical/product decision).
 */
export const pathologyCategorySchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  /** Presigned and short-lived (the scan type's icon). Never persist it. */
  imageUrl: z.string().nullable(),
});

export type PathologyCategory = z.infer<typeof pathologyCategorySchema>;

export const PATHOLOGY_STATUSES = ['draft', 'published', 'pending_review'] as const;
export const pathologyStatusSchema = z.enum(PATHOLOGY_STATUSES);
export type PathologyStatus = z.infer<typeof pathologyStatusSchema>;

/**
 * GET /api/pathology-gallery list item. Verified against the local
 * production mirror, 2026-09-14 (296 Echo items sampled).
 *
 * Every item on the mirror carries a Vimeo `videoUrl` and an
 * `i.vimeocdn.com` thumbnail; none carry `imageUrl` — it exists on the model
 * but is dead weight in the data GUSI has actually published, so it is
 * modelled but never relied on by the gallery UI.
 */
export const pathologyGalleryItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().nullish(),
  subCategory: z.string().nullish(),
  description: z.string().nullish(),
  videoUrl: z.string().nullish(),
  videoThumbnailUrl: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  status: pathologyStatusSchema,
  /**
   * Null (via the API, backed by the model's schema default) or, on the wire
   * as stored, entirely absent — the 17 unmapped items on the production
   * mirror predate this field and were deliberately left unbackfilled (see
   * the module doc comment above), so their raw document has no `scanTypeId`
   * key at all. `.nullish()` accepts both; a mapped item always sends the
   * string id.
   */
  scanTypeId: z.string().nullish(),
});

export type PathologyGalleryItem = z.infer<typeof pathologyGalleryItemSchema>;
