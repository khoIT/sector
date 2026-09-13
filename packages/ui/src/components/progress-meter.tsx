import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { progressMeterPercentage } from './progress-meter-percentage';
import { Progress, type ProgressTone } from './progress';

export type ProgressMeterProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** How far along — "9" of a 25-question course, "7" of an 8-question quiz. */
  value: number;
  max: number;
  /** Left-aligned label, e.g. a bank's title or "Progress". */
  label: ReactNode;
  /** Right-aligned, defaults to "value of max" in tabular figures. */
  valueLabel?: ReactNode;
  tone?: ProgressTone;
};

/**
 * A labelled progress bar: a caption row ("Cardiac (Basic)" / "9 of 25") over
 * the plain <Progress> bar. Used everywhere a value has a known, meaningful
 * denominator — question-bank cards, the quiz runner's header — as opposed to
 * <Progress> alone, which only knows a bare percentage.
 */
export const ProgressMeter = forwardRef<HTMLDivElement, ProgressMeterProps>(function ProgressMeter(
  { value, max, label, valueLabel, tone = 'accent', className, ...props },
  ref,
) {
  const percentage = progressMeterPercentage(value, max);

  return (
    <div ref={ref} className={cn('flex flex-col gap-1.5', className)} {...props}>
      <div className="flex items-baseline justify-between gap-2 text-body">
        <span className="text-ink-dim">{label}</span>
        <span className="sv-num text-ink-dim">{valueLabel ?? `${value} of ${max}`}</span>
      </div>
      <Progress value={percentage} tone={tone} />
    </div>
  );
});
