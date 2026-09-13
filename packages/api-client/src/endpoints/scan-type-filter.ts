import { z } from 'zod';

import type { ApiClient } from '../client';
import { scanTypeFilterOptionSchema, type ScanTypeFilterOption } from '../schemas/scan-type-filter';

const scanTypeFilterOptionsSchema = z.array(scanTypeFilterOptionSchema);

/** GET /api/scan-type/filter-options. Unauthenticated server-side; we send the header anyway. */
export async function getScanTypeFilterOptions(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<ScanTypeFilterOption[]> {
  return client.get('/api/scan-type/filter-options', {
    schema: scanTypeFilterOptionsSchema,
    signal,
  });
}
