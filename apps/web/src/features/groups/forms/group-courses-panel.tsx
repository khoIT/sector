import {
  isApiError,
  useAddCourseToGroupMutation,
  useGroupCourses,
  useRemoveCourseFromGroupMutation,
} from '@sector/api-client';
import { Button, EmptyState, Input, Skeleton } from '@sector/ui';
import { BookOpen, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';

import { GroupDetailTabs, type GroupDetailLocationState } from '../group-detail-tabs';

/**
 * A group's whole-roster course enrolment — add/remove a course for every
 * member of the group. A different concern from a per-member assignment
 * (the `assignments` tab): this is `groupCourseService`'s many-to-many
 * `GroupCourse` join, not a `GroupAssignment` row with its own due date.
 *
 * Adding a course takes a pasted course id: no course-catalog browser exists
 * in Sector yet (course authoring is its own domain), so this is the honest
 * v1 rather than a picker built on an unverified endpoint. See
 * `endpoints/group-course.ts`.
 */
export function GroupCoursesPanel() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  const groupName = (location.state as GroupDetailLocationState)?.groupName;
  const title = groupName ?? t('groups.members.title');

  const [courseIdInput, setCourseIdInput] = useState('');
  const [addError, setAddError] = useState<string | undefined>();

  const query = useGroupCourses(groupId);
  const addCourse = useAddCourseToGroupMutation(groupId ?? '');
  const removeCourse = useRemoveCourseFromGroupMutation(groupId ?? '');

  if (!groupId) return null;

  async function submitAdd() {
    setAddError(undefined);
    const trimmed = courseIdInput.trim();
    if (!trimmed) {
      setAddError(t('groups.courses.idRequired'));
      return;
    }
    try {
      await addCourse.mutateAsync(trimmed);
      setCourseIdInput('');
    } catch {
      // Rendered from addCourse.error below.
    }
  }

  return (
    <section aria-label={title}>
      <GroupDetailTabs groupId={groupId} title={title} active="courses" />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="add-course-id" className="text-body font-medium text-ink">
            {t('groups.courses.addLabel')}
          </label>
          <Input
            id="add-course-id"
            value={courseIdInput}
            onChange={(event) => setCourseIdInput(event.target.value)}
            placeholder={t('groups.courses.addPlaceholder')}
            className="w-72"
          />
        </div>
        <Button size="sm" disabled={addCourse.isPending} onClick={() => void submitAdd()}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {addCourse.isPending ? t('groups.courses.adding') : t('groups.courses.add')}
        </Button>
      </div>

      {addError || addCourse.isError ? (
        <p className="mb-3 text-[12px] text-crit">
          {addError ??
            (isApiError(addCourse.error) ? addCourse.error.message : t('groups.courses.addError'))}
        </p>
      ) : null}

      {query.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : query.isError ? (
        <EmptyState
          tone="crit"
          icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
          title={t('groups.courses.loadError')}
          description={isApiError(query.error) ? query.error.message : undefined}
        />
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" aria-hidden />}
          title={t('groups.courses.empty.title')}
          description={t('groups.courses.empty.description')}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {query.data?.items.map((course) => (
            <li
              key={course.id}
              className="flex items-center justify-between gap-3 rounded-token border border-line p-3"
            >
              <span className="font-medium text-ink">{course.title}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('groups.courses.remove')}
                disabled={removeCourse.isPending}
                onClick={() => removeCourse.mutate(course.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-crit" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
