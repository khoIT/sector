import type { CourseOutlineItem } from '@sector/api-client';
import { StatusPill } from '@sector/ui';
import { CircleCheck, FileQuestion, Lock, PlayCircle } from 'lucide-react';
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

export type OutlineSidebarProps = {
  courseId: string;
  items: readonly CourseOutlineItem[];
  currentItemId: string;
};

const KIND_ICON = { lesson: PlayCircle, topic: PlayCircle, quiz: FileQuestion } as const;

/**
 * The runner's own navigation: the SAME resolved, ordered array the outline
 * page renders (`groupOutlineItemsForDisplay`, unchanged), but every row is
 * now a real link into this phase's item route rather than an anchor into a
 * page that cannot open anything — closing exactly the gap
 * `course-outline-item-row.tsx`'s own doc comment names ("Not a link — see
 * the phase report for why: the course runner this would open is the next
 * phase, not this one").
 */
export function OutlineSidebar({ courseId, items, currentItemId }: OutlineSidebarProps) {
  const { t } = useTranslation();
  const groups = groupOutlineItemsForDisplay(items);

  return (
    <nav aria-label={t('courses.runner.sidebar.title')} className="flex flex-col gap-3">
      <h3 className="text-body font-semibold text-ink-dim">{t('courses.runner.sidebar.title')}</h3>
      <ol className="flex flex-col gap-2">
        {groups.map((group) => (
          <li key={group.header.id} className="flex flex-col gap-1.5">
            <OutlineSidebarRow
              courseId={courseId}
              item={group.header}
              current={currentItemId === group.header.id}
            />
            {group.children.length > 0 ? (
              <ol className="flex flex-col gap-1.5 pl-3">
                {group.children.map((child) => (
                  <li key={child.id}>
                    <OutlineSidebarRow
                      courseId={courseId}
                      item={child}
                      current={currentItemId === child.id}
                    />
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function OutlineSidebarRow({
  courseId,
  item,
  current,
}: {
  courseId: string;
  item: CourseOutlineItem;
  current: boolean;
}) {
  const { t } = useTranslation();
  const Icon = item.blockedReason ? Lock : KIND_ICON[item.kind];
  const rowClasses = `flex items-start gap-2 rounded-token border px-2.5 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-accent-ink ${
    current ? 'border-accent-ink bg-accent-soft' : 'border-line bg-surface hover:bg-surface-2'
  }`;

  // A blocked item (a published quiz with no questions) explains itself
  // instead of pretending to be openable — same call the outline page makes
  // for the same reason.
  if (item.blockedReason) {
    return (
      <div className={rowClasses} aria-disabled="true">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-dim" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-ink-dim">{item.title}</span>
          <span className="text-[12px] text-crit">
            {t(blockedReasonLabelKey(item.blockedReason))}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Link
      to={courseItemPathFor(courseId, item.id)}
      className={rowClasses}
      aria-current={current ? 'page' : undefined}
    >
      {item.status === 'completed' ? (
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
      ) : (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-dim" aria-hidden />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-ink">{item.title}</span>
        <span className="text-[12px] text-ink-dim">{t(itemKindLabelKey(item.kind))}</span>
      </div>
      <StatusPill
        tone={courseProgressTone(item.status)}
        label={t(itemStatusLabelKey(item.status))}
      />
    </Link>
  );
}
