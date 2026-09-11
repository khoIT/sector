import { useQuery } from '@tanstack/react-query';

import {
  getFindingDefinitions,
  getOrganizationFindingDefinitions,
  getScanTypes,
  getUserOrganizations,
} from '../endpoints/create-scan-lookups';
import { scanTypeKeys } from '../query-keys';
import { useApiClient } from './api-provider';

/**
 * Scan-type lookups. All four are configuration, not user data: they change
 * when an admin edits a scan type, which is rare, so they carry a long
 * staleTime instead of refetching on every wizard step.
 */
const CONFIG_STALE_TIME = 5 * 60 * 1000;

export function useScanTypes(enabled = true) {
  const client = useApiClient();

  return useQuery({
    queryKey: scanTypeKeys.list(),
    queryFn: ({ signal }) => getScanTypes(client, signal),
    enabled,
    staleTime: CONFIG_STALE_TIME,
  });
}

/**
 * The findings definition for one scan type, org-scoped when an organization
 * is known. Both variants return `{items, forms}`; the org route narrows the
 * items to that organization's configuration.
 */
export function useFindingDefinitions(scanTypeId: string | null, organizationId?: string | null) {
  const client = useApiClient();

  return useQuery({
    queryKey: organizationId
      ? scanTypeKeys.orgItems(organizationId, scanTypeId ?? '')
      : scanTypeKeys.items(scanTypeId ?? ''),
    queryFn: ({ signal }) =>
      organizationId
        ? getOrganizationFindingDefinitions(client, organizationId, scanTypeId as string, signal)
        : getFindingDefinitions(client, scanTypeId as string, signal),
    enabled: Boolean(scanTypeId),
    staleTime: CONFIG_STALE_TIME,
  });
}

export function useUserOrganizations(userId: string | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: scanTypeKeys.organizations(userId ?? ''),
    queryFn: ({ signal }) => getUserOrganizations(client, userId as string, signal),
    enabled: Boolean(userId),
    staleTime: CONFIG_STALE_TIME,
  });
}
