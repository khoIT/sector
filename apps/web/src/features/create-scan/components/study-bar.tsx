import { Button, cn } from '@scanvault/ui';
import { ArrowRight, Check, ChevronDown, Circle, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ReadinessItem, ReadinessState } from '../model/readiness';

/**
 * The study's chrome: what it is, who will see it, and what is still missing.
 *
 * It replaced a four-step stepper, and the difference is not cosmetic. A
 * stepper answers "where am I", which is the wrong question for a document —
 * nothing here has to happen in an order, and the gates that enforced one
 * protected nothing. The question a learner actually asks before submitting is
 * "what is still missing", and that is what the readiness group answers.
 *
 * The bar holds CONTROLS and STATUS, never position. If a chip ever needs a
 * "current step" highlight, this design has gone wrong and turned back into
 * navigation.
 */
export type StudyBarProps = {
  /** Chips, each opening the control it names. */
  children: ReactNode;
  readiness: readonly ReadinessItem[];
  onReview: () => void;
  reviewDisabled?: boolean;
};

export function StudyBar({ children, readiness, onReview, reviewDisabled }: StudyBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-token border border-line',
        'bg-surface-2 px-3 py-2',
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>

      <div
        className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1"
        aria-label="What is still missing"
      >
        {readiness.map((item) => (
          <ReadinessChip key={item.id} item={item} />
        ))}
      </div>

      <Button size="sm" onClick={onReview} disabled={reviewDisabled}>
        Review &amp; submit
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}

/**
 * `empty` is a hollow dot, not a dash. A row of four dashes reads as four
 * things gone wrong, and one of them is the note, which is genuinely optional —
 * an untouched note is not a problem to be fixed.
 */
const STATE_ICON: Record<ReadinessState, typeof Check> = {
  done: Check,
  partial: Minus,
  empty: Circle,
};

function ReadinessChip({ item }: { item: ReadinessItem }) {
  const Icon = STATE_ICON[item.state];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-[12px]',
        item.state === 'done' ? 'text-ok' : item.state === 'partial' ? 'text-warn' : 'text-ink-dim',
      )}
    >
      <Icon
        className={cn('h-3 w-3 shrink-0', item.state === 'empty' && 'opacity-50')}
        aria-hidden
      />
      <span className="text-ink-dim">{item.label}</span>
      {item.detail ? <span className="sv-num">{item.detail}</span> : null}
    </span>
  );
}

/**
 * One control in the bar: a labelled value that opens what it names.
 *
 * The value is the point, not the label — a learner scanning the bar wants to
 * read "Cardiac", not "Exam type:". So the label is dim and small and the
 * value carries the weight.
 */
export function StudyChip({
  label,
  value,
  icon,
  onClick,
  expanded,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  onClick: () => void;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={cn(
        'inline-flex max-w-[16rem] items-center gap-1.5 rounded-token border border-line',
        'bg-surface px-2.5 py-1 text-body outline-none transition-colors',
        'hover:border-accent-ink/30 hover:bg-surface-2',
        'focus-visible:ring-2 focus-visible:ring-accent-ink',
        expanded && 'border-accent-ink/40 bg-surface-2',
      )}
    >
      {icon}
      <span className="sr-only">{label}: </span>
      <span className="min-w-0 truncate text-ink" title={value}>
        {value}
      </span>
      <ChevronDown
        className={cn('h-3.5 w-3.5 shrink-0 text-ink-dim transition-transform', expanded && 'rotate-180')}
        aria-hidden
      />
    </button>
  );
}
