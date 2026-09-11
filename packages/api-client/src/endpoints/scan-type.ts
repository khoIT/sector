import type { ApiClient } from '../client';
import { scanTypeItemsSchema, type ScanTypeItems } from '../schemas/scan-type';

/**
 * GET /api/scan-type/:scanTypeId/items — the findings rows and dynamic form
 * definitions for one scan type, used to turn stored answer keys back into
 * human labels.
 */
export async function getScanTypeItems(
  client: ApiClient,
  scanTypeId: string,
  signal?: AbortSignal,
): Promise<ScanTypeItems> {
  return client.get(`/api/scan-type/${scanTypeId}/items`, {
    schema: scanTypeItemsSchema,
    signal,
  });
}
