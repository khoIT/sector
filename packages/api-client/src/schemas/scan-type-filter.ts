import { z } from 'zod';

/**
 * GET /api/scan-type/filter-options — the source for the Scan Type filter.
 *
 * Returns distinct scan-type names collapsed onto their BASE key: the stored
 * key is versioned (`v6_vascular`) while the filter takes the unversioned
 * `baseKey` (`vascular`). Sending the versioned key to a list route is a hard
 * 400 (`scanTypeKeys not found: v6_vascular`), so the two must not be mixed up.
 *
 * Flat array, not paginated. Lives in its own file rather than in a full
 * `scan-type.ts` so the create-scan surface can add the wizard's scan-type and
 * dynamic-form schemas without colliding with this one.
 */
export const scanTypeFilterOptionSchema = z.object({
  name: z.string(),
  baseKey: z.string(),
});

export type ScanTypeFilterOption = z.infer<typeof scanTypeFilterOptionSchema>;
