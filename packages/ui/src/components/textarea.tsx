import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';

import { cn } from '../lib/cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  /** Rendered under the field in --crit, and flips the field to the error look. */
  error?: string;
  /** Rendered under the field in --ink-dim when there is no error. */
  hint?: ReactNode;
};

/**
 * The multi-line twin of <Input>, with the same label/error/hint wiring.
 *
 * Feedback fields grow as they are written into, so the height is a floor
 * (`min-h`) and vertical resize stays on: a reviewer writing six paragraphs of
 * teaching points should not be typing into a three-line porthole.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, error, hint, id, rows = 3, ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const describedById = error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined;

  return (
    <div className="flex w-full flex-col gap-1">
      {label ? (
        <label htmlFor={textareaId} className="text-[12px] font-medium text-ink-dim">
          {label}
        </label>
      ) : null}

      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedById}
        className={cn(
          'w-full resize-y rounded-token border bg-surface px-2.5 py-1.5 text-body text-ink',
          'placeholder:text-ink-dim/70 outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:border-accent-ink',
          'disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-crit' : 'border-line',
          className,
        )}
        {...props}
      />

      {error ? (
        <p id={`${textareaId}-error`} className="text-[12px] text-crit">
          {error}
        </p>
      ) : hint ? (
        <p id={`${textareaId}-hint`} className="text-[12px] text-ink-dim">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
