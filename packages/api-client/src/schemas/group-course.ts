import { z } from 'zod';

/**
 * A course enrolled on a whole GROUP — `GET /api/groups/manage/course/:groupId`
 * (`manager.controller.ts`), scoped server-side by `assertLeadsGroup`. A
 * different concept from a group ASSIGNMENT (`schemas/group-assignment.ts`):
 * this enrols the group's members in a course generally; an assignment
 * targets specific members with a due date.
 *
 * The route answers the raw `CourseDocument[]` (`groupCourseService`
 * populates `course` on each `GroupCourse` row and the controller sends the
 * populated documents directly) — only the fields this list renders are
 * modelled, matching `V2Course`'s own field names (`course.model.ts`).
 */
export const groupCourseSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string().optional(),
  status: z.string().optional(),
});

export type GroupCourse = z.infer<typeof groupCourseSchema>;
