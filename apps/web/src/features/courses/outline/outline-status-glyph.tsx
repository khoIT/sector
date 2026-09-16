import type { CourseOutlineItem } from '@sector/api-client';
import { Circle, CircleCheck, CircleDot, CircleX, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { itemStatusLabelKey } from './course-outline-model';

export type OutlineStatus = CourseOutlineItem['status'];

const GLYPH: Record<OutlineStatus, { Icon: typeof Circle; className: string }> = {
  completed: { Icon: CircleCheck, className: 'text-ok' },
  in_progress: { Icon: CircleDot, className: 'text-accent-ink' },
  // A quiz answered in full below its passing mark. It is not "in progress" —
  // the learner finished it and did not pass — so it gets its own mark rather
  // than being folded into the amber one and read as unfinished.
  failed: { Icon: CircleX, className: 'text-crit' },
  not_started: { Icon: Circle, className: 'text-ink-dim' },
};

/**
 * One item's state as a single mark: done, started, or neither.
 *
 * Shared by the module rows on the landing page and the contents pane in the
 * player so the two never drift into describing the same state differently —
 * the outline page's `StatusPill` says it in words, which is right for a row
 * with space and wrong for a dense list where the eye is scanning down a
 * column of marks.
 *
 * The label is carried on `title` and a visually hidden span rather than left
 * to colour alone, because "green circle" is not a status to someone who
 * cannot distinguish it from the grey one.
 */
export function OutlineStatusGlyph({
  status,
  blocked = false,
  className = '',
}: {
  status: OutlineStatus;
  blocked?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();

  if (blocked) {
    return (
      <span className={`inline-flex shrink-0 ${className}`}>
        <Lock className="h-4 w-4 text-ink-dim" aria-hidden />
      </span>
    );
  }

  const { Icon, className: tone } = GLYPH[status] ?? GLYPH.not_started;
  const label = t(itemStatusLabelKey(status));

  return (
    <span className={`inline-flex shrink-0 ${className}`} title={label}>
      <Icon className={`h-4 w-4 ${tone}`} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
