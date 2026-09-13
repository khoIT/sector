import type { CourseOutlineItem } from '@sector/api-client';
import { StatusPill } from '@sector/ui';
import { CircleHelp, FileQuestion, Lock, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { courseProgressTone } from '../my-courses/course-row-model';
import {
  blockedReasonLabelKey,
  itemKindLabelKey,
  itemStatusLabelKey,
} from './course-outline-model';

const KIND_ICON = {
  lesson: PlayCircle,
  topic: PlayCircle,
  quiz: FileQuestion,
} as const;

export type CourseOutlineItemRowProps = {
  item: CourseOutlineItem;
  /** Whether this is the item the resume action would open. */
  isResumeTarget: boolean;
  /** Indentation for a child under its lesson; the header row of a group is 0. */
  indent: boolean;
};

/**
 * One row of the outline.
 *
 * A plain `<div>`, not a list item: the caller (`course-outline-page.tsx`)
 * already wraps every row in its own `<li>` to build the ordered list, and
 * this component used to render a SECOND `<li>` inside that one — invalid
 * `<li>` nested directly in `<li>`, caught only by a cold browser load
 * (`scripts/check/cold-load-sweep.mjs`), because the suites run with no DOM
 * and nothing here ever renders in them. The `id` stays: it is the anchor the
 * Resume/Start/Review action jumps to.
 *
 * Not a link (see the phase report for why: the course runner this would
 * open is the next phase, not this one). Kind, title and status are always
 * shown; a blocked item explains itself instead of pretending to be
 * openable, and the resume target is highlighted so the Start/Resume/Review
 * action above has something visible to point at when it jumps here.
 */
export function CourseOutlineItemRow({ item, isResumeTarget, indent }: CourseOutlineItemRowProps) {
  const { t } = useTranslation();
  const Icon = item.blockedReason ? Lock : KIND_ICON[item.kind];

  return (
    <div
      id={`item-${item.id}`}
      className={`flex flex-wrap items-center gap-2 rounded-token border px-3 py-2 ${
        isResumeTarget ? 'border-accent-ink bg-accent-soft' : 'border-line bg-surface'
      } ${indent ? 'ml-5' : ''}`}
    >
      <Icon className="h-4 w-4 shrink-0 text-ink-dim" aria-hidden />

      <span className="text-[11px] uppercase tracking-wide text-ink-dim">
        {t(itemKindLabelKey(item.kind))}
      </span>

      <span className="flex-1 text-body text-ink">{item.title}</span>

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
    </div>
  );
}
