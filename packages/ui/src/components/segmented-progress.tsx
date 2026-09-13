import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../lib/cn';
import { segmentStates } from './segmented-progress-state';

export type SegmentedProgressProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onClick'> & {
  /** Number of segments — the question count. */
  total: number;
  currentIndex: number;
  /** Which segments are already answered. */
  isDoneAt: (index: number) => boolean;
  /** Jump navigation. Omit to render a purely visual (non-interactive) bar. */
  onJumpTo?: (index: number) => void;
  label: string;
};

const SEGMENT_TONE: Record<'current' | 'done' | 'todo', string> = {
  current: 'bg-accent',
  done: 'bg-ok',
  todo: 'bg-surface-2',
};

/**
 * The quiz runner's "one tick per question" bar — every segment ticks as
 * `todo` -> `done`, and the one under the learner's eye reads as `current`
 * regardless of whether it is already answered (see segmented-progress-state.ts
 * for why `current` outranks `done`).
 *
 * Clickable when `onJumpTo` is given, which is the engine's "jump" navigation
 * capability surfaced as UI — a learner can jump back to any question to
 * review or change an answer, not just step with Previous/Next.
 */
export const SegmentedProgress = forwardRef<HTMLDivElement, SegmentedProgressProps>(
  function SegmentedProgress(
    { total, currentIndex, isDoneAt, onJumpTo, label, className, ...props },
    ref,
  ) {
    const states = segmentStates(total, currentIndex, isDoneAt);

    return (
      <div
        ref={ref}
        role="group"
        aria-label={label}
        className={cn('flex gap-1', className)}
        {...props}
      >
        {states.map((state, index) => {
          const tone = SEGMENT_TONE[state];
          const shared = cn('h-1.5 flex-1 rounded-full transition-colors', tone);

          if (!onJumpTo) {
            return <span key={index} aria-hidden className={shared} />;
          }

          return (
            <button
              key={index}
              type="button"
              aria-label={`Question ${index + 1}`}
              aria-current={state === 'current' ? 'step' : undefined}
              onClick={() => onJumpTo(index)}
              className={cn(
                shared,
                'outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
              )}
            />
          );
        })}
      </div>
    );
  },
);
