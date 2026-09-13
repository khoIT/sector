import { z } from 'zod';

/** POST and DELETE /api/scan/:scanId/tags share this body shape. */
export const scanTagPayloadSchema = z.object({ tag: z.string() });

export type ScanTagPayload = z.infer<typeof scanTagPayloadSchema>;
