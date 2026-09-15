import type { CourseOutline } from '@sector/api-client';
import { Ring } from '@sector/ui';
import { useTranslation } from 'react-i18next';

import { formatDurationShort, summariseOutline } from '../outline/outline-summary';

export type CourseShellHeaderProps = {
  courseTitle: string | undefined;
  outline: CourseOutline;
};

/**
 * The course's standing header: how far through it the learner is, and how
 * much is left to watch.
 *
 * It fetches nothing and takes the resolved outline as a prop, so the outline
 * page and the persistent player shell can both mount it against the same
 * data rather than each re-deriving it.
 *
 * The counts come from the server's own totals, not from the summary's item
 * count: the server excludes blocked items from `totalItems` and this must
 * agree with the percentage the rest of the product shows. The summary is
 * consulted only for the runtime line, which the server does not compute.
 */
export function CourseShellHeader({ courseTitle, outline }: CourseShellHeaderProps) {
  const { t } = useTranslation();
  const percent =
    outline.totalItems === 0 ? 0 : Math.round((outline.completedItems / outline.totalItems) * 100);

  const { remainingSeconds } = summariseOutline(outline.items);
  // Nothing left to watch needs no line: the completion banner already says
  // so, and "0s left to watch" reads like a stopwatch ran out.
  const remaining = remainingSeconds ? formatDurationShort(remainingSeconds) : null;

  return (
    <header className="mb-4 flex items-center gap-4">
      <Ring
        percentage={percent}
        size={56}
        label={t('courses.outline.progress', {
          completed: outline.completedItems,
          total: outline.totalItems,
          percent,
        })}
      >
        <span className="sv-num text-[13px] font-semibold text-ink">{percent}%</span>
      </Ring>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[17px] font-semibold text-ink">
          {courseTitle ?? t('courses.outline.title')}
        </h2>
        <p className="sv-num text-body text-ink-dim">
          {t('courses.outline.progress', {
            completed: outline.completedItems,
            total: outline.totalItems,
            percent,
          })}
          {/* Only when a runtime is actually known. A course whose videos are
              all private would otherwise claim "0m left" with hours in it. */}
          {remaining === null ? null : (
            <>
              {' · '}
              {t('courses.outline.remaining', { duration: remaining })}
            </>
          )}
        </p>
      </div>
    </header>
  );
}
