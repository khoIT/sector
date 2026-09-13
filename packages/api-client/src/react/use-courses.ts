import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getLearnerCourses, type CoursesListQuery } from '../endpoints/course';
import { courseKeys } from '../query-keys';
import { useApiClient } from './api-provider';

export type UseCoursesOptions = {
  query?: CoursesListQuery;
  enabled?: boolean;
};

/**
 * My Courses. The server does the keyword/status filtering and the
 * pagination — see `getLearnerCourses` — so the hook is a thin cache wrapper,
 * not a place to re-filter what already came back scoped and paged.
 */
export function useCourses({ query = {}, enabled = true }: UseCoursesOptions = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: courseKeys.list(query),
    queryFn: ({ signal }) => getLearnerCourses(client, query, signal),
    enabled,
    // Keep the previous page's rows on screen while a keyword, status or page
    // change is in flight, so the grid does not collapse to a spinner on
    // every keystroke — same trade-off as useGroups.
    placeholderData: keepPreviousData,
  });
}
