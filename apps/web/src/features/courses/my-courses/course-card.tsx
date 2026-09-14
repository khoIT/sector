import type { LearnerCourseListItem } from '@sector/api-client';
import { Button, Card, CardContent, StatusPill } from '@sector/ui';
import { GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { coursePathFor } from '../courses-links';
import { courseActionLabelKey, courseProgressTone, roundedProgress } from './course-row-model';

export type CourseCardProps = {
  item: LearnerCourseListItem;
};

/**
 * One enrolment, as a card rather than a table row: a course library is a
 * grid of covers in every LMS this replaces, and the fields that matter here
 * — a thumbnail, a progress bar, one action — line up in a grid far better
 * than in dense table columns built for six-figure scan queues.
 */
export function CourseCard({ item }: CourseCardProps) {
  const { t } = useTranslation();
  const percent = roundedProgress(item.progress.progress);

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex aspect-[16/9] items-center justify-center bg-surface-2">
        {item.course.imageUrl ? (
          <img src={item.course.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <GraduationCap className="h-8 w-8 text-ink-dim" aria-hidden />
        )}
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-body font-semibold text-ink">{item.course.title}</h3>
          <StatusPill
            tone={courseProgressTone(item.progress.status)}
            label={t(`courses.index.status.${item.progress.status}`)}
          />
        </div>

        <div className="mt-auto flex flex-col gap-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${percent}%` }}
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('courses.index.progressLabel', { percent })}
            />
          </div>
          <p className="sv-num text-[12px] text-ink-dim">
            {t('courses.index.progressLabel', { percent })}
          </p>
        </div>

        <Button asChild variant="secondary" size="sm">
          {/* `state.title` closes the gap `course-outline-page.tsx` documents
              (its heading falls back to a generic label without it) and is
              carried forward again from there into the course runner. */}
          <Link to={coursePathFor(item.course.id)} state={{ title: item.course.title }}>
            {t(courseActionLabelKey(item.progress.status), { title: item.course.title })}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
