import type { CourseOutlineItem } from '@sector/api-client';
import { Card, CardContent, EmptyState, StatusPill } from '@sector/ui';
import { FileQuestion, Lock, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { courseItemPathFor } from '../courses-links';
import { courseProgressTone } from '../my-courses/course-row-model';
import {
  blockedReasonLabelKey,
  groupOutlineItemsForDisplay,
  itemKindLabelKey,
  itemStatusLabelKey,
} from '../outline/course-outline-model';
import { formatDurationShort } from '../outline/outline-summary';
import { buildModuleCards, type ModuleCard } from './module-card-model';

const KIND_ICON = {
  lesson: PlayCircle,
  topic: PlayCircle,
  quiz: FileQuestion,
} as const;

export type ModulePageProps = {
  courseId: string;
  /** Forwarded into each card's `<Link state>`, same reasoning as the
   *  outline page's own fallback title. */
  courseTitle: string | undefined;
  /** The lesson being viewed — the group header to find in `items`. */
  lessonItem: CourseOutlineItem;
  /** The whole resolved outline, already in server order. */
  items: readonly CourseOutlineItem[];
};

/**
 * What a lesson shows: the topics and quizzes under it, as cards.
 *
 * This replaces the authored lesson body. Those bodies were a
 * hand-maintained HTML table of links to the lesson's own children, and
 * 1,051 of their 1,468 hrefs are absolute URLs on the retired dashboard
 * host — the sanitiser sends an absolute link to a new tab, so React Router
 * never sees the click and the learner lands on a dead host. The outline
 * already knows the same children, in the same order, with this learner's
 * status on each, so the list is rendered from data instead of from prose.
 *
 * The authored HTML is untouched in the database; it simply stops being the
 * thing on screen.
 */
export function ModulePage({ courseId, courseTitle, lessonItem, items }: ModulePageProps) {
  const { t } = useTranslation();

  const group = groupOutlineItemsForDisplay(items).find(
    (candidate) => candidate.header.id === lessonItem.id,
  );
  const cards = buildModuleCards(group?.children ?? []);

  // 166 lessons in the library have no published child at all. A blank panel
  // reads as a failed load; this says which it is.
  if (cards.length === 0) {
    return (
      <EmptyState
        title={t('courses.module.empty.title')}
        description={t('courses.module.empty.description')}
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <li key={card.id} className="flex">
          <ModuleCardTile courseId={courseId} courseTitle={courseTitle} card={card} />
        </li>
      ))}
    </ul>
  );
}

type ModuleCardTileProps = {
  courseId: string;
  courseTitle: string | undefined;
  card: ModuleCard;
};

function ModuleCardTile({ courseId, courseTitle, card }: ModuleCardTileProps) {
  const { t } = useTranslation();
  const Icon = card.blockedReason ? Lock : KIND_ICON[card.kind];
  const duration = formatDurationShort(card.durationSeconds);

  const tile = (
    <Card className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex aspect-[16/9] items-center justify-center bg-surface-2">
        {card.imageUrl ? (
          <img src={card.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Icon className="h-7 w-7 text-ink-dim" aria-hidden />
        )}
      </div>

      <CardContent className="flex flex-1 flex-col gap-2 pt-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-ink-dim">
          <span>{t(itemKindLabelKey(card.kind))}</span>
          {/* Absent rather than zero for a quiz and for a video Vimeo will
              not describe — see `outline-summary.ts`. */}
          {duration ? <span className="sv-num normal-case tracking-normal">{duration}</span> : null}
        </div>

        <h3 className="text-body text-ink">{card.title}</h3>

        <div className="mt-auto pt-1">
          {card.blockedReason ? (
            <span className="text-[12px] text-crit">
              {t(blockedReasonLabelKey(card.blockedReason))}
            </span>
          ) : (
            <StatusPill
              tone={courseProgressTone(card.status)}
              label={t(itemStatusLabelKey(card.status))}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );

  // A quiz with no questions opens on nothing, so it is not a link — the
  // same rule the outline row applies.
  if (card.blockedReason) {
    return (
      <div className="w-full" aria-disabled="true">
        {tile}
      </div>
    );
  }

  return (
    <Link
      to={courseItemPathFor(courseId, card.id)}
      state={{ title: courseTitle }}
      className="w-full rounded-token outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
    >
      {tile}
    </Link>
  );
}
