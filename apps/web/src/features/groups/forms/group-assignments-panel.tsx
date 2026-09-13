import {
  isApiError,
  useCreateGroupAssignmentMutation,
  useGroupAssignments,
  useGroupCourseOptions,
  useGroupLearners,
  userDisplayName,
  type GroupAssignment,
} from '@sector/api-client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatusPill,
} from '@sector/ui';
import { ClipboardList, Plus, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';

import { formatDate } from '@/lib/format';

import { GroupDetailTabs, type GroupDetailLocationState } from '../group-detail-tabs';

/** `GroupAssignment.status` -> the closest existing badge tone. */
function assignmentStatusTone(status: GroupAssignment['status']) {
  switch (status) {
    case 'completed':
      return 'ok' as const;
    case 'cancelled':
      return 'crit' as const;
    case 'in_progress':
      return 'accent' as const;
    default:
      return 'neutral' as const;
  }
}

/**
 * Per-member course assignments with a due date — course-level only. See the
 * module doc on `schemas/group-assignment.ts` for why lesson/topic/quiz
 * assignment is out of scope here.
 */
export function GroupAssignmentsPanel() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  const groupName = (location.state as GroupDetailLocationState)?.groupName;
  const title = groupName ?? t('groups.members.title');

  const assignments = useGroupAssignments(groupId);

  if (!groupId) return null;

  return (
    <section aria-label={title}>
      <GroupDetailTabs groupId={groupId} title={title} active="assignments" />

      <div className="mb-4 flex justify-end">
        <CreateAssignmentDialog groupId={groupId} />
      </div>

      {assignments.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : assignments.isError ? (
        <EmptyState
          tone="crit"
          icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
          title={t('groups.assignments.loadError')}
          description={isApiError(assignments.error) ? assignments.error.message : undefined}
        />
      ) : (assignments.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
          title={t('groups.assignments.empty.title')}
          description={t('groups.assignments.empty.description')}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {assignments.data?.items.map((assignment) => (
            <li
              key={assignment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-token border border-line p-3"
            >
              <div>
                <div className="font-medium text-ink">
                  {typeof assignment.user === 'string'
                    ? assignment.user
                    : userDisplayName(assignment.user)}
                </div>
                <div className="text-[12px] text-ink-dim">
                  {assignment.dueDate
                    ? t('groups.assignments.dueDate', { date: formatDate(assignment.dueDate) })
                    : t('groups.assignments.noDueDate')}
                </div>
              </div>
              <StatusPill
                tone={assignmentStatusTone(assignment.status)}
                label={t(`groups.assignments.status.${assignment.status}`)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateAssignmentDialog({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const courseOptions = useGroupCourseOptions(groupId);
  const learners = useGroupLearners(groupId);
  const createAssignment = useCreateGroupAssignmentMutation(groupId);

  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedLearners, setSelectedLearners] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | undefined>();

  function handleOpenChange(next: boolean) {
    if (createAssignment.isPending) return;
    setOpen(next);
    if (next) {
      setCourseId('');
      setDueDate('');
      setSelectedLearners(new Set());
      setFormError(undefined);
      createAssignment.reset();
    }
  }

  function toggleLearner(userId: string) {
    setSelectedLearners((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function submit() {
    setFormError(undefined);
    if (!courseId) {
      setFormError(t('groups.assignments.form.courseRequired'));
      return;
    }
    if (selectedLearners.size === 0) {
      setFormError(t('groups.assignments.form.learnersRequired'));
      return;
    }

    try {
      await createAssignment.mutateAsync({
        group: groupId,
        courseId,
        userIds: [...selectedLearners],
        dueDate: dueDate || undefined,
      });
      setOpen(false);
    } catch {
      // Rendered from createAssignment.error below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('groups.assignments.form.trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('groups.assignments.form.title')}</DialogTitle>
          <DialogDescription>{t('groups.assignments.form.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="assignment-course" className="text-body font-medium text-ink">
              {t('groups.assignments.form.courseLabel')}
            </label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger
                id="assignment-course"
                placeholder={t('groups.assignments.form.coursePlaceholder')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(courseOptions.data ?? []).map((course) => (
                  <SelectItem key={course.courseId} value={course.courseId}>
                    {course.courseTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="assignment-due-date" className="text-body font-medium text-ink">
              {t('groups.assignments.form.dueDateLabel')}
            </label>
            <Input
              id="assignment-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-body font-medium text-ink">
              {t('groups.assignments.form.learnersLabel')}
            </legend>
            <div className="max-h-48 overflow-y-auto rounded-token border border-line p-2">
              {learners.isPending ? (
                <Skeleton className="h-20 w-full" />
              ) : (learners.data ?? []).length === 0 ? (
                <p className="text-body text-ink-dim">{t('groups.assignments.form.noLearners')}</p>
              ) : (
                learners.data?.map((learner) => (
                  <label
                    key={learner.userId}
                    className="flex items-center gap-2 py-1 text-body text-ink"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                      checked={selectedLearners.has(learner.userId)}
                      onChange={() => toggleLearner(learner.userId)}
                    />
                    {learner.firstName || learner.lastName
                      ? `${learner.firstName ?? ''} ${learner.lastName ?? ''}`.trim()
                      : learner.userName}
                  </label>
                ))
              )}
            </div>
          </fieldset>
        </div>

        {formError || createAssignment.isError ? (
          <p className="text-[12px] text-crit">
            {formError ??
              (isApiError(createAssignment.error)
                ? createAssignment.error.message
                : t('groups.assignments.form.error'))}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => handleOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button size="sm" disabled={createAssignment.isPending} onClick={() => void submit()}>
            {createAssignment.isPending
              ? t('groups.assignments.form.saving')
              : t('groups.assignments.form.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
