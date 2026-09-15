import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createGroupAssignment,
  getAssignmentsForGroup,
  getGroupCourseOptions,
  getGroupLearners,
  getMyDashboardAssignments,
  type GetGroupAssignmentsQuery,
  type MyAssignmentsQuery,
} from '../endpoints/group-assignment';
import { groupKeys, mutationKeys, myAssignmentKeys } from '../query-keys';
import type { CreateGroupAssignmentPayload } from '../schemas/group-assignment';
import { useApiClient } from './api-provider';

const LOOKUP_STALE_TIME = 60 * 1000;

/** Learners eligible to be assigned, for the create-assignment form's picker. */
export function useGroupLearners(groupId: string | undefined, keyword = '') {
  const client = useApiClient();

  return useQuery({
    queryKey: groupKeys.learners(groupId ?? '', keyword),
    queryFn: () => getGroupLearners(client, groupId as string, keyword || undefined),
    enabled: Boolean(groupId),
    staleTime: LOOKUP_STALE_TIME,
  });
}

/** This group's own courses, for the create-assignment form's course picker. */
export function useGroupCourseOptions(groupId: string | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: groupKeys.courseOptions(groupId ?? ''),
    queryFn: () => getGroupCourseOptions(client, groupId as string),
    enabled: Boolean(groupId),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useAssignmentsForGroup(
  groupId: string | undefined,
  query: GetGroupAssignmentsQuery = {},
) {
  const client = useApiClient();

  return useQuery({
    queryKey: groupKeys.assignments(groupId ?? '', query),
    queryFn: () => getAssignmentsForGroup(client, groupId as string, query),
    enabled: Boolean(groupId),
    placeholderData: keepPreviousData,
  });
}

export function useCreateGroupAssignmentMutation(groupId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.createGroupAssignment(),
    mutationFn: (payload: CreateGroupAssignmentPayload) => createGroupAssignment(client, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.assignmentsRoot(groupId) });
    },
  });
}

export type UseMyAssignmentsDueOptions = MyAssignmentsQuery & { enabled?: boolean };

/**
 * The caller's own assignments, narrowed to a due window. Used by the "Due
 * this week" panel on the learner home.
 */
export function useMyAssignmentsDue({ enabled = true, ...query }: UseMyAssignmentsDueOptions) {
  const client = useApiClient();

  return useQuery({
    queryKey: myAssignmentKeys.dueSoon(query),
    queryFn: ({ signal }) => getMyDashboardAssignments(client, query, signal),
    enabled,
  });
}
