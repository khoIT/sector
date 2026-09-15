import type { CourseOutlineItem } from '@sector/api-client';
import { StatusPill } from '@sector/ui';
import { CircleHelp, FileQuestion, Lock, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { courseItemPathFor } from '../courses-links';
import { courseProgressTone } from '../my-courses/course-row-model';
import {
  blockedReasonLabelKey,
  itemKindLabelKey,
  itemStatusLabelKey,
} from './course-outline-model';
import { formatDurationShort } from './outline-summary';

const KIND_ICON = {
  lesson: PlayCircle,
  topic: PlayCircle,
  quiz: FileQuestion,
} as const;

export type CourseOutlineItemRowProps = {
  courseId: string;
  /** Forwarded into the runner's `<Link state>`, same reasoning as
   *  `course-outline-page.tsx`'s own fallback title. */
  courseTitle: string | undefined;
  item: CourseOutlineItem;
  /** Whether this is the item the resume action would open. */
  isResumeTarget: boolean;
  /** Indentation for a child under its lesson; the header row of a group is 0. */
  indent: boolean;
};

/**
 * One row of the outline — a real link into the course runner
 * (`/learn/courses/:courseId/:itemId`) now that it exists, closing the gap
 * this component's own previous doc comment named ("the course runner this
 * would open is the next phase, not this one"). A blocked item still
 * explains itself instead of linking anywhere: it has no questions to open.
 *
 * A plain wrapper, not a list item, either way: the caller
 * (`course-outline-page.tsx`) already wraps every row in its own `<li>`.
 */
export function CourseOutlineItemRow({
  courseId,
  courseTitle,
  item,
  isResumeTarget,
  indent,
}: CourseOutlineItemRowProps) {
  const { t } = useTranslation();
  const Icon = item.blockedReason ? Lock : KIND_ICON[item.kind];
  const rowClasses = `flex flex-wrap items-center gap-2 rounded-token border px-3 py-2 ${
    isResumeTarget ? 'border-accent-ink bg-accent-soft' : 'border-line bg-surface'
  } ${indent ? 'ml-5' : ''}`;

  const body = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-ink-dim" aria-hidden />

      <span className="text-[11px] uppercase tracking-wide text-ink-dim">
        {t(itemKindLabelKey(item.kind))}
      </span>

      <span className="flex-1 text-body text-ink">{item.title}</span>

      {/* Null for a lesson, a quiz, and for the private videos Vimeo will not
          describe — the chip is absent rather than showing a wrong number. */}
      {formatDurationShort(item.durationSeconds) ? (
        <span className="sv-num text-[12px] text-ink-dim">
          {formatDurationShort(item.durationSeconds)}
        </span>
      ) : null}

      {item.quiz && item.quiz.attempts > 0 ? (
        <span className="sv-num text-[12px] text-ink-dim">
          {t('courses.outline.quiz.bestPercentage', { percent: item.quiz.bestPercentage ?? 0 })}
        </span>
      ) : null}

      {item.blockedReason ? (
        <span className="flex items-center gap-1 text-[12px] text-crit">
          <CircleHelp className="h-3.5 w-3.5" aria-hidden />
          {t(blockedReasonLabelKey(item.blockedReason))}
        </span>
      ) : (
        <StatusPill
          tone={courseProgressTone(item.status)}
          label={t(itemStatusLabelKey(item.status))}
        />
      )}
    </>
  );

  if (item.blockedReason) {
    return (
      <div id={`item-${item.id}`} className={rowClasses} aria-disabled="true">
        {body}
      </div>
    );
  }

  return (
    <Link
      id={`item-${item.id}`}
      to={courseItemPathFor(courseId, item.id)}
      state={{ title: courseTitle }}
      className={`${rowClasses} outline-none focus-visible:ring-2 focus-visible:ring-accent-ink`}
    >
      {body}
    </Link>
  );
}
