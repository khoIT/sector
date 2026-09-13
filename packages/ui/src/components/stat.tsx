import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export type StatProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  label: ReactNode;
  /** The headline figure — "78%", "4:12", "7 of 8". Rendered in tabular figures. */
  value: ReactNode;
  /** Small supporting text under the value, e.g. "Passed". */
  hint?: ReactNode;
};

/**
 * A label over a big number — the quiz results card's score/time/attempts
 * row. Plain composition (no computed logic), styled with tokens only.
 */
export const Stat = forwardRef<HTMLDivElement, StatProps>(function Stat(
  { label, value, hint, className, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn('flex flex-col gap-0.5', className)} {...props}>
      <span className="text-body text-ink-dim">{label}</span>
      <span className="sv-num text-[20px] font-semibold leading-tight text-ink">{value}</span>
      {hint ? <span className="text-body text-ink-dim">{hint}</span> : null}
    </div>
  );
});
