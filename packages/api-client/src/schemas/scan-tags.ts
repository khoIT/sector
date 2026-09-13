import { z } from 'zod';

/** POST and DELETE /api/scan/:scanId/tags share this body shape. */
export const scanTagPayloadSchema = z.object({ tag: z.string() });

export type ScanTagPayload = z.infer<typeof scanTagPayloadSchema>;

/**
 * GET /api/scan/:scanId/tags. The raw tag array — the same field `scanSchema`
 * already models as `Scan.tags`, just requested on its own rather than as
 * part of the whole scan.
 */
export const scanTagsResponseSchema = z.array(z.string());
