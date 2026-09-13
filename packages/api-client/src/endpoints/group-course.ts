import type { ApiClient } from '../client';
import { paginatedSchema, type Paginated } from '../envelope';
import { groupCourseSchema, type GroupCourse } from '../schemas/group-course';

const paginatedGroupCourseSchema = paginatedSchema(groupCourseSchema);

export type GroupCourseListQuery = {
  keyword?: string;
  page?: number;
  limit?: number;
};

/**
 * GET /api/groups/manage/course/:groupId — this group's own enrolled
 * courses, scoped by `assertLeadsGroup`.
 *
 * Adding a course here requires its id: no course-catalog browser exists in
 * Sector yet (course authoring/catalog is its own domain, not group
 * administration), so the add-course form takes a pasted course id rather
 * than a search picker. A real picker is a known gap, not a workaround.
 */
export async function getGroupCourses(
  client: ApiClient,
  groupId: string,
  query: GroupCourseListQuery = {},
): Promise<Paginated<GroupCourse>> {
  return client.get(`/api/groups/manage/course/${groupId}`, {
    query: {
      page: String(query.page ?? 1),
      limit: String(query.limit ?? 50),
      ...(query.keyword?.trim() ? { keyword: query.keyword.trim() } : {}),
    },
    schema: paginatedGroupCourseSchema,
  });
}

/** POST /api/groups/manage/course/:groupId. */
export async function addCourseToGroup(
  client: ApiClient,
  groupId: string,
  courseId: string,
): Promise<void> {
  await client.post(`/api/groups/manage/course/${groupId}`, { body: { courseId } });
}

/** DELETE /api/groups/manage/course/:groupId. */
export async function removeCourseFromGroup(
  client: ApiClient,
  groupId: string,
  courseId: string,
): Promise<void> {
  await client.del(`/api/groups/manage/course/${groupId}`, { body: { courseId } });
}
