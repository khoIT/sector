import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  /** Rendered under the field in --crit, and flips the field to the error look. */
  error?: string;
  /** Rendered under the field in --ink-dim when there is no error. */
  hint?: ReactNode;
  /** Use tabular figures. Set it for IDs, counts, dates typed as numbers. */
  numeric?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, hint, numeric, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedById = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex w-full flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="text-[12px] font-medium text-ink-dim">
          {label}
        </label>
      ) : null}

      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedById}
        className={cn(
          'h-8 w-full rounded-token border bg-surface px-2.5 text-body text-ink',
          'placeholder:text-ink-dim/70 outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:border-accent-ink',
          'disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-crit' : 'border-line',
          numeric && 'sv-num',
          className,
        )}
        {...props}
      />

      {error ? (
        <p id={`${inputId}-error`} className="text-[12px] text-crit">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-[12px] text-ink-dim">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
