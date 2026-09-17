import type { CourseOutlineItem } from '@sector/api-client';
import { cn } from '@sector/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { formatPlayheadTimestamp } from '@/lib/format';

import { courseItemPathFor } from '../courses-links';
import {
  blockedReasonLabelKey,
  groupOutlineItemsForDisplay,
  type CourseOutlineGroup,
} from '../outline/course-outline-model';
import { OutlineStatusGlyph } from '../outline/outline-status-glyph';
import {
  formatDurationShort,
  groupTotalSeconds,
  summariseOutline,
} from '../outline/outline-summary';
import { isGroupOpen } from './sidebar-groups';
import { WATCH_COMPLETION_PERCENT } from './watch-position';

export type OutlineSidebarProps = {
  courseId: string;
  items: readonly CourseOutlineItem[];
  currentItemId: string;
  /**
   * Called when the learner opens an item. The drawer below `lg` uses it to
   * close itself; the desktop column passes nothing, because a pane that is
   * always there has nothing to close.
   */
  onNavigate?: () => void;
};

/**
 * The runner's navigation: where the learner is in the course, and how much of
 * it is left.
 *
 * Collapsed by module rather than flat. On a 65-item course the flat list was
 * a four-thousand-pixel column beside a single screen of content, so the
 * module holding the current item opens and the rest stay as one row each —
 * but every module can now be opened by hand, because the previous version
 * gave no way to look ahead without leaving the item you were on.
 */
export function OutlineSidebar({
  courseId,
  items,
  currentItemId,
  onNavigate,
}: OutlineSidebarProps) {
  const { t } = useTranslation();
  const groups = groupOutlineItemsForDisplay(items);
  const summary = summariseOutline(items);
  const percent =
    summary.totalItems > 0
      ? Math.min(100, Math.round((summary.completedItems / summary.totalItems) * 100))
      : 0;
  const remaining = formatDurationShort(summary.remainingSeconds);

  // Seeded from the current item, then owned by the learner. Re-seeded when the
  // current item moves to another module — following Next into a new module
  // should open it, not leave the pane pointing at where they were.
  const [openIds, setOpenIds] = useState<readonly string[]>(() =>
    groups.filter((group) => isGroupOpen(group, currentItemId)).map((group) => group.header.id),
  );
  useEffect(() => {
    const active = groups.find((group) => isGroupOpen(group, currentItemId));
    if (!active) return;
    setOpenIds((open) => (open.includes(active.header.id) ? open : [...open, active.header.id]));
    // `groups` is rebuilt on every render; the current item is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItemId]);

  return (
    <nav
      aria-label={t('courses.runner.sidebar.title')}
      className="flex max-h-full flex-col overflow-hidden rounded-token border border-line bg-surface"
    >
      <div className="flex flex-col gap-2 border-b border-line px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-body font-semibold text-ink">
            {t('courses.runner.contents.title')}
          </span>
          <span className="sv-num text-[12px] text-ink-dim">
            {summary.completedItems}/{summary.totalItems}
            {remaining ? ` · ${t('courses.landing.timeLeft', { duration: remaining })}` : ''}
          </span>
        </div>
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('courses.runner.courseProgress', { percent })}
        >
          <div className="h-full rounded-full bg-accent-ink" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ol className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {groups.map((group) => (
          <li key={group.header.id}>
            <ModuleSection
              courseId={courseId}
              group={group}
              currentItemId={currentItemId}
              onNavigate={onNavigate}
              open={openIds.includes(group.header.id)}
              onToggle={() =>
                setOpenIds((ids) =>
                  ids.includes(group.header.id)
                    ? ids.filter((id) => id !== group.header.id)
                    : [...ids, group.header.id],
                )
              }
            />
          </li>
        ))}
      </ol>

      <p className="border-t border-line px-3.5 py-2.5 text-[11px] text-ink-dim">
        {t('courses.runner.completionNote', { percent: WATCH_COMPLETION_PERCENT })}
      </p>
    </nav>
  );
}

function ModuleSection({
  courseId,
  group,
  currentItemId,
  onNavigate,
  open,
  onToggle,
}: {
  courseId: string;
  group: CourseOutlineGroup;
  currentItemId: string;
  onNavigate?: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const children = group.children.filter((child) => !child.blockedReason);
  const done = children.filter((child) => child.status === 'completed').length;
  const minutes = formatDurationShort(groupTotalSeconds(group));
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-token px-2 py-1.5 text-left text-body outline-none',
          'hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-ink',
          currentItemId === group.header.id && 'bg-accent-soft',
        )}
      >
        <Chevron className="h-3.5 w-3.5 shrink-0 text-ink-dim" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{group.header.title}</span>
        {children.length > 0 ? (
          <span className="sv-num shrink-0 text-[11px] text-ink-dim">
            {done}/{children.length}
            {minutes ? ` · ${minutes}` : ''}
          </span>
        ) : null}
      </button>

      {open && group.children.length > 0 ? (
        <ol className="flex flex-col">
          {group.children.map((child) => (
            <li key={child.id}>
              <ItemRow
                courseId={courseId}
                item={child}
                current={currentItemId === child.id}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function ItemRow({
  courseId,
  item,
  current,
  onNavigate,
}: {
  courseId: string;
  item: CourseOutlineItem;
  current: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();

  // A quiz with no questions explains itself rather than pretending to open.
  if (item.blockedReason) {
    return (
      <div className="flex items-start gap-2 px-2 py-1.5 pl-7 text-body" aria-disabled="true">
        <OutlineStatusGlyph status={item.status} blocked className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ink-dim">{item.title}</span>
          <span className="text-[11px] text-crit">
            {t(blockedReasonLabelKey(item.blockedReason))}
          </span>
        </span>
      </div>
    );
  }

  const timestamp = formatPlayheadTimestamp(item.durationSeconds);

  return (
    <Link
      to={courseItemPathFor(courseId, item.id)}
      onClick={onNavigate}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex items-start gap-2 rounded-token px-2 py-1.5 pl-7 text-body outline-none',
        'hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-ink',
        current && 'bg-accent-soft',
      )}
    >
      <OutlineStatusGlyph status={item.status} className="mt-0.5" />
      <span className="min-w-0 flex-1 truncate text-ink">{item.title}</span>
      {item.kind === 'quiz' && item.quiz ? (
        <span className="sv-num shrink-0 rounded-full border border-line px-1.5 text-[10px] text-ink-dim">
          {t('courses.runner.questionCount', { count: item.quiz.questionCount })}
        </span>
      ) : timestamp ? (
        <span className="sv-num shrink-0 text-[11px] text-ink-dim">{timestamp}</span>
      ) : null}
    </Link>
  );
}
