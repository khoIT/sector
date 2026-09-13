import { useQuery } from '@tanstack/react-query';

import { getCourseOutline } from '../endpoints/course';
import { courseKeys } from '../query-keys';
import { useApiClient } from './api-provider';

export type UseCourseOutlineOptions = {
  courseId: string;
  enabled?: boolean;
};

/**
 * The resolved course outline: one ordered list, a resume pointer, and the
 * course's own progress — see `schemas/course-outline.ts` for the shape and
 * why nothing here re-derives navigation from it.
 */
export function useCourseOutline({ courseId, enabled = true }: UseCourseOutlineOptions) {
  const client = useApiClient();

  return useQuery({
    queryKey: courseKeys.outline(courseId),
    queryFn: ({ signal }) => getCourseOutline(client, courseId, signal),
    enabled: enabled && courseId.length > 0,
  });
}
