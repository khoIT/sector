import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import { coursePathFor } from '../courses-links';
import { roundedProgress } from '../my-courses/course-row-model';

export type CourseLayoutProps = {
  courseId: string;
  /** Falls back to a generic label — see `course-runner-page.tsx`'s doc
   *  comment on why no route here can guarantee a real course title. */
  courseTitle: string | undefined;
  itemTitle: string;
  progress: number;
  sidebar: ReactNode;
  children: ReactNode;
};

/**
 * The chrome every item route shares: a breadcrumb back to the outline, the
 * course's own progress bar, and a two-pane layout with the sidebar on the
 * right (matching `course-outline-page.tsx`'s single-column reading order —
 * content first, navigation second — rather than the legacy dashboard's
 * collapsible LEFT sidebar, which this phase does not reproduce).
 */
export function CourseLayout({
  courseId,
  courseTitle,
  itemTitle,
  progress,
  sidebar,
  children,
}: CourseLayoutProps) {
  const { t } = useTranslation();
  const percent = roundedProgress(progress);

  return (
    <section aria-label={itemTitle} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          to={coursePathFor(courseId)}
          className="inline-flex w-fit items-center gap-1 text-body text-accent-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent-ink"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          {courseTitle ?? t('courses.outline.title')}
        </Link>
        <h2 className="text-[17px] font-semibold text-ink">{itemTitle}</h2>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
          </div>
          <p className="sv-num text-body text-ink-dim">
            {t('courses.runner.courseProgress', { percent })}
          </p>
        </div>
      </div>

      <div className="flex flex-col-reverse items-start gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="w-full flex-shrink-0 lg:w-80">{sidebar}</div>
      </div>
    </section>
  );
}
