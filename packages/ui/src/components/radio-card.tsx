import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { radioCardStateClasses, type RadioCardReveal } from './radio-card-state';

/**
 * Inline glyphs rather than a `lucide-react` import: that package is a
 * dependency of `apps/web`, not of `@sector/ui` (see CONTRACTS.md §3), so a
 * primitive that needs an icon draws its own, the same way DialogContent's
 * close glyph does.
 */
function CheckGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 shrink-0 text-ok">
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 shrink-0 text-crit">
      <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export type RadioCardProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role'> & {
  /** `radio` for a single-answer question, `checkbox` for multi-select. */
  role: 'radio' | 'checkbox';
  selected: boolean;
  reveal?: RadioCardReveal;
  /** Shown before the option text — "A", "B", "C"… */
  optionKey?: ReactNode;
  children: ReactNode;
};

/**
 * A selectable answer card — the quiz runner's option row for both answer
 * types. `role="radio"` for a single-choice question (the runner enforces
 * exclusivity by only ever selecting one at a time), `role="checkbox"` for
 * "select all that apply". The colour/border state is pure function of
 * (selected, reveal) in ./radio-card-state.ts.
 */
export const RadioCard = forwardRef<HTMLButtonElement, RadioCardProps>(function RadioCard(
  { role, selected, reveal = 'unrevealed', optionKey, children, className, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-token border p-3 text-left text-body transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:pointer-events-none disabled:opacity-90',
        radioCardStateClasses(selected, reveal),
        className,
      )}
      {...props}
    >
      {optionKey ? (
        <span className="sv-num flex h-6 w-6 shrink-0 items-center justify-center rounded-token border border-line bg-surface-2 text-[12px] font-semibold text-ink-dim">
          {optionKey}
        </span>
      ) : null}

      <span className="flex-1">{children}</span>

      {reveal === 'correct' ? <CheckGlyph /> : null}
      {reveal === 'incorrect' && selected ? <CrossGlyph /> : null}
    </button>
  );
});
