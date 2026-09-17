import type { LearnerCourseListItem } from '@sector/api-client';
import { Button, StatusPill } from '@sector/ui';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { courseCardModel } from './course-card-model';
import { CourseCounts, CourseMeta, CourseProgressBar } from './course-facts';

export type CourseListRowProps = {
  item: LearnerCourseListItem;
};

/**
 * One enrolment as a row, for a learner with more courses than a grid can
 * show at once.
 *
 * A card spends most of its height on things that do not vary between rows —
 * a cover strip, a progress bar with its own line of text. At 50 enrolments
 * that is four screens of scrolling to answer "which of these have I
 * finished?". The row puts the same facts on one line from `sm` up and stacks
 * them below it, where the screen is too narrow for columns anyway.
 */
export function CourseListRow({ item }: CourseListRowProps) {
  const { t } = useTranslation();
  const model = courseCardModel(item);

  return (
    <div className="flex flex-col gap-2 rounded-token border border-line bg-surface px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to={model.href}
            state={{ title: model.title }}
            className="min-w-0 truncate text-body font-medium text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent-ink"
          >
            {model.title}
          </Link>
          <StatusPill tone={model.tone} label={t(model.statusKey)} />
        </div>
        <CourseCounts model={model} />
        <CourseMeta model={model} />
      </div>

      <div className="w-full shrink-0 sm:w-40">
        <CourseProgressBar model={model} />
      </div>

      <Button asChild variant="secondary" size="sm" className="shrink-0 justify-center">
        <Link to={model.href} state={{ title: model.title }}>
          {t(model.actionLabelKey, { title: model.title })}
        </Link>
      </Button>
    </div>
  );
}
