import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getGroupAssignments, type AssignmentListQuery } from '../endpoints/assignment';
import { assignmentKeys } from '../query-keys';
import { useApiClient } from './api-provider';

export function useGroupAssignments(query: AssignmentListQuery, enabled = true) {
  const client = useApiClient();

  return useQuery({
    queryKey: assignmentKeys.list(query.groupId, query),
    queryFn: ({ signal }) => getGroupAssignments(client, query, signal),
    enabled: enabled && Boolean(query.groupId),
    placeholderData: keepPreviousData,
  });
}
