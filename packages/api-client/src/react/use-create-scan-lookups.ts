import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

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

/**
 * Fetch one scan type's definitions on demand, outside a render.
 *
 * The scan-type picker needs the DESTINATION type's definitions before it can
 * say what a switch would clear, and that type is not known until the click.
 * `fetchQuery` reuses the same key and the same staleTime as the hook above,
 * so a type the user has already visited answers from cache with no request,
 * and a type fetched here is warm for the hook that renders it next.
 */
export function useFindingDefinitionsFetcher() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useCallback(
    (scanTypeId: string, organizationId?: string | null) =>
      queryClient.fetchQuery({
        queryKey: organizationId
          ? scanTypeKeys.orgItems(organizationId, scanTypeId)
          : scanTypeKeys.items(scanTypeId),
        queryFn: ({ signal }) =>
          organizationId
            ? getOrganizationFindingDefinitions(client, organizationId, scanTypeId, signal)
            : getFindingDefinitions(client, scanTypeId, signal),
        staleTime: CONFIG_STALE_TIME,
      }),
    [client, queryClient],
  );
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
