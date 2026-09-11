import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

export type ProgressTone = 'accent' | 'ok' | 'warn' | 'crit';

export type ProgressProps = Omit<HTMLAttributes<HTMLDivElement>, 'role'> & {
  /** 0-100. Values outside the range are clamped. */
  value: number;
  /** Omit for a determinate bar; pass a label for screen readers. */
  label?: string;
  tone?: ProgressTone;
  /**
   * Draw a moving stripe instead of a fixed width. Use ONLY when real progress
   * is genuinely unknown — an indeterminate bar over a known byte count is the
   * spinner-that-lies this design set out to remove.
   */
  indeterminate?: boolean;
};

const TONE_FILL: Record<ProgressTone, string> = {
  accent: 'bg-accent',
  ok: 'bg-ok',
  warn: 'bg-warn',
  crit: 'bg-crit',
};

/**
 * A thin determinate bar. The track is --surface-2 so it reads as an inset in
 * both themes; the fill is a token colour, never a gradient.
 */
export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { value, label, tone = 'accent', indeterminate = false, className, ...props },
  ref,
) {
  const clamped = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)}
      {...props}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-200 ease-out',
          TONE_FILL[tone],
          indeterminate && 'sv-progress-indeterminate',
        )}
        style={{ width: indeterminate ? '40%' : `${clamped}%` }}
      />
    </div>
  );
});
