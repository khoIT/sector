import {
  isApiError,
  useAddCourseToGroupMutation,
  useGroupCourses,
  useRemoveCourseFromGroupMutation,
  type GroupCourse,
} from '@sector/api-client';
import { Button, EmptyState, Input, Skeleton } from '@sector/ui';
import { BookOpen, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { errorMessage } from '@/lib/error-message';

import { ConfirmActionDialog } from '../confirm-action-dialog';
import { GroupDetailTabs } from '../group-detail-tabs';
import { useGroupDetailTitle } from '../use-group-detail-title';

/**
 * A group's whole-roster course enrolment — add/remove a course for every
 * member of the group. A different concern from a per-member assignment
 * (the `assignments` tab): this is `groupCourseService`'s many-to-many
 * `GroupCourse` join, not a `GroupAssignment` row with its own due date.
 *
 * Removing confirms first and reports its failure. It used to be a single
 * unguarded click that un-enrolled every member of the group from a course,
 * and `removeCourse.isError` was never read anywhere in this file, so a 403
 * or a 404 left the row sitting there with no explanation.
 *
 * Adding a course takes a pasted course id: no course-catalog browser exists
 * in Sector yet (course authoring is its own domain), so this is the honest
 * v1 rather than a picker built on an unverified endpoint. See
 * `endpoints/group-course.ts`.
 */
export function GroupCoursesPanel() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const title = useGroupDetailTitle(groupId);

  const [courseIdInput, setCourseIdInput] = useState('');
  const [addError, setAddError] = useState<string | undefined>();
  const [pendingRemoval, setPendingRemoval] = useState<GroupCourse | null>(null);

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

  function closeRemoveDialog(open: boolean) {
    if (!open) {
      setPendingRemoval(null);
      removeCourse.reset();
    }
  }

  async function applyRemove() {
    if (!pendingRemoval) return;
    try {
      await removeCourse.mutateAsync(pendingRemoval.id);
      setPendingRemoval(null);
    } catch {
      // Held open; rendered from removeCourse.error inside the dialog.
    }
  }

  return (
    <section aria-label={title}>
      <GroupDetailTabs groupId={groupId} active="courses" />

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
          {addError ?? errorMessage(addCourse.error, t('groups.courses.addError'))}
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
                aria-label={t('groups.courses.removeFor', { title: course.title })}
                onClick={() => setPendingRemoval(course)}
              >
                <Trash2 className="h-3.5 w-3.5 text-crit" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmActionDialog
        open={pendingRemoval !== null}
        onOpenChange={closeRemoveDialog}
        title={t('groups.courses.removeConfirmTitle')}
        description={
          <Trans
            i18nKey="groups.courses.removeConfirmDescription"
            values={{ title: pendingRemoval?.title ?? '' }}
            components={{ strong: <strong className="font-semibold text-ink" /> }}
          />
        }
        error={
          removeCourse.isError
            ? errorMessage(removeCourse.error, t('groups.courses.removeError'))
            : undefined
        }
        isPending={removeCourse.isPending}
        pendingLabel={t('groups.courses.removing')}
        confirmLabel={t('groups.courses.remove')}
        onConfirm={() => void applyRemove()}
      />
    </section>
  );
}
