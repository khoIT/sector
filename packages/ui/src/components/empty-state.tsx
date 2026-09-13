import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export type EmptyStateProps = {
  title: ReactNode;
  /** One sentence on what to do next. Keep it actionable. */
  description?: ReactNode;
  /** Small decorative glyph. Pass a lucide icon element sized h-5 w-5. */
  icon?: ReactNode;
  /** Primary action, usually a <Button>. */
  action?: ReactNode;
  className?: string;
  /** `crit` recolours the frame for an error empty state. */
  tone?: 'neutral' | 'crit';
};

/**
 * Covers all three no-content cases: nothing yet, nothing matched the filters,
 * and the request failed. Pass `tone="crit"` plus a retry button for the last.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  tone = 'neutral',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-token border border-dashed px-6 py-10 text-center',
        tone === 'crit' ? 'border-crit/40 bg-crit-soft' : 'border-line bg-surface-2',
        className,
      )}
    >
      {icon ? (
        <span className={cn('mb-1', tone === 'crit' ? 'text-crit' : 'text-ink-dim')}>{icon}</span>
      ) : null}

      <p className={cn('text-[14px] font-semibold', tone === 'crit' ? 'text-crit' : 'text-ink')}>
        {title}
      </p>

      {description ? <p className="max-w-prose text-body text-ink-dim">{description}</p> : null}

      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
