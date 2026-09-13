import type { LearnerCourseListItem } from '@sector/api-client';
import { Badge } from '@sector/ui';
import { useTranslation } from 'react-i18next';

export type ExpiredCoursesSectionProps = {
  items: readonly LearnerCourseListItem[];
};

/**
 * The `expired` array the API sends beside `items`.
 *
 * Kept visually and structurally separate from the active grid rather than
 * merged in with a status pill: an expired enrolment is not one more course
 * to continue, and folding it into the same grid the legacy dashboard never
 * did either — it is its own list here so a learner cannot mistake "this
 * used to be enrolled" for "this needs your attention".
 */
export function ExpiredCoursesSection({ items }: ExpiredCoursesSectionProps) {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  return (
    <div className="mt-8 border-t border-line pt-4">
      <h3 className="mb-2 text-[15px] font-semibold text-ink">
        {t('courses.index.expired.title', { count: items.length })}
      </h3>
      <p className="mb-3 text-body text-ink-dim">{t('courses.index.expired.description')}</p>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-token border border-line bg-surface-2 px-3 py-2"
          >
            <span className="text-body text-ink-dim">{item.course.title}</span>
            <Badge tone="neutral">{t('courses.index.expired.badge')}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
