import { useTranslation } from 'react-i18next';

import { formatDate } from '@/lib/format';

import type { CourseCardModel } from './course-card-model';

/**
 * The three small pieces a course card and a course list row both draw.
 *
 * Shared components rather than copied markup: the whole reason both
 * renderers read one model is that they must not state different facts, and
 * two copies of "{{lessons}} modules · …" would find a way to disagree.
 */

/** What the course is made of, from the version's own totals. */
export function CourseCounts({ model }: { model: CourseCardModel }) {
  const { t } = useTranslation();

  // Three zeroes means the version predates these totals, not that the course
  // is empty. Saying "0 modules · 0 topics" about a published course is worse
  // than saying nothing.
  if (model.countsUnknown) return null;

  return (
    <p className="sv-num truncate text-[12px] text-ink-dim">
      {t('courses.index.counts', {
        lessons: model.counts.lessons,
        topics: model.counts.topics,
        quizzes: model.counts.quizzes,
      })}
    </p>
  );
}

/** How far through it the learner is. */
export function CourseProgressBar({ model }: { model: CourseCardModel }) {
  const { t } = useTranslation();
  const label = t('courses.index.progressLabel', { percent: model.percent });

  return (
    <div className="flex flex-col gap-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${model.percent}%` }}
          role="progressbar"
          aria-valuenow={model.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
      <p className="sv-num text-[12px] text-ink-dim">{label}</p>
    </div>
  );
}

/**
 * When it runs out, and when they last opened it.
 *
 * Both are optional on the wire — 1,783 of the mirror's live group courses
 * carry no `expiresAt` at all — so each line appears only when there is a date
 * to show, and the block disappears entirely when there is neither.
 */
export function CourseMeta({ model }: { model: CourseCardModel }) {
  const { t } = useTranslation();

  if (!model.expiresAt && !model.lastActiveAt) return null;

  return (
    <p className="sv-num flex flex-wrap gap-x-3 text-[11px] text-ink-dim">
      {model.expiresAt ? (
        <span>{t('courses.index.expiresOn', { date: formatDate(model.expiresAt) })}</span>
      ) : null}
      {model.lastActiveAt ? (
        <span>{t('courses.index.lastActive', { date: formatDate(model.lastActiveAt) })}</span>
      ) : null}
    </p>
  );
}
