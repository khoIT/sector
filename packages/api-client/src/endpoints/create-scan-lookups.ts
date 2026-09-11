import { z } from 'zod';

import type { ApiClient } from '../client';
import {
  findingDefinitionsResponseSchema,
  organizationSchema,
  scanTypeSummarySchema,
  type FindingDefinitionsResponse,
  type Organization,
  type ScanTypeSummary,
} from '../schemas/create-scan-lookups';

/**
 * Scan-type and organization lookups that feed the create-scan wizard.
 *
 * Server-side finding worth raising separately: /api/scan-type/list,
 * /list/filter, /list/full and /:id/items carry NO authUser middleware, and
 * neither does any /api/scan-forms/* route. The client sends the bearer anyway.
 */

/** GET /api/scan-type/list — the scan-type picker source. */
export async function getScanTypes(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<ScanTypeSummary[]> {
  return client.get('/api/scan-type/list', {
    schema: z.array(scanTypeSummarySchema),
    signal,
  });
}

/** GET /api/scan-type/:scanTypeId/items — the findings definition. */
export async function getFindingDefinitions(
  client: ApiClient,
  scanTypeId: string,
  signal?: AbortSignal,
): Promise<FindingDefinitionsResponse> {
  return client.get(`/api/scan-type/${scanTypeId}/items`, {
    schema: findingDefinitionsResponseSchema,
    signal,
  });
}

/**
 * GET /api/scan-type-org/:scanTypeId/items?organization= — the same findings
 * definition, narrowed to one organization's configuration.
 */
export async function getOrganizationFindingDefinitions(
  client: ApiClient,
  organizationId: string,
  scanTypeId: string,
  signal?: AbortSignal,
): Promise<FindingDefinitionsResponse> {
  return client.get(`/api/scan-type-org/${scanTypeId}/items`, {
    query: { organization: organizationId },
    schema: findingDefinitionsResponseSchema,
    signal,
  });
}

/** GET /api/users/:userId/organizations — drives org-specific gates. */
export async function getUserOrganizations(
  client: ApiClient,
  userId: string,
  signal?: AbortSignal,
): Promise<Organization[]> {
  return client.get(`/api/users/${userId}/organizations`, {
    schema: z.array(organizationSchema),
    signal,
  });
}
