import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addCourseToGroup,
  getGroupCourses,
  removeCourseFromGroup,
  type GroupCourseListQuery,
} from '../endpoints/group-course';
import { groupKeys, mutationKeys } from '../query-keys';
import { useApiClient } from './api-provider';

export function useGroupCourses(groupId: string | undefined, query: GroupCourseListQuery = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: groupKeys.courses(groupId ?? '', query),
    queryFn: () => getGroupCourses(client, groupId as string, query),
    enabled: Boolean(groupId),
    placeholderData: keepPreviousData,
  });
}

export function useAddCourseToGroupMutation(groupId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.addCourseToGroup(),
    mutationFn: (courseId: string) => addCourseToGroup(client, groupId, courseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.coursesRoot(groupId) });
    },
  });
}

export function useRemoveCourseFromGroupMutation(groupId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.removeCourseFromGroup(),
    mutationFn: (courseId: string) => removeCourseFromGroup(client, groupId, courseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.coursesRoot(groupId) });
    },
  });
}
