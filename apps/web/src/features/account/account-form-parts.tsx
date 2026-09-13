import { cn } from '@sector/ui';
import type { ReactNode } from 'react';

/**
 * The two pieces every form on this page repeats: a labelled field that can
 * carry an error, and an inline notice.
 *
 * Notices are inline and persistent rather than toasts. A server refusal here
 * names the thing the user has to change — "Old Password is incorrect" — and a
 * message that disappears on a timer is a message someone can miss while they
 * are still looking at the field that caused it.
 */

export function AccountField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-body font-medium text-ink">
        {label}
      </label>

      {children}

      {/* role="alert" is what announces the message when it appears, so the
          error does not depend on the control carrying an aria-describedby it
          would have to be threaded through every caller. */}
      {error ? (
        <p id={errorId} role="alert" className="text-[12px] text-crit">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[12px] text-ink-dim">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormNotice({ tone, children }: { tone: 'ok' | 'crit'; children: ReactNode }) {
  return (
    <p
      role={tone === 'crit' ? 'alert' : 'status'}
      className={cn(
        'rounded-token border px-3 py-2 text-body',
        tone === 'crit'
          ? 'border-crit/25 bg-crit-soft text-crit'
          : 'border-ok/25 bg-ok-soft text-ok',
      )}
    >
      {children}
    </p>
  );
}
