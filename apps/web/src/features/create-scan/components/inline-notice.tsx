import { cn } from '@scanvault/ui';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export type NoticeTone = 'info' | 'ok' | 'warn' | 'crit';

export type InlineNoticeProps = {
  tone?: NoticeTone;
  title: ReactNode;
  /** What went wrong or what is true. One sentence, names the thing. */
  children?: ReactNode;
  /** The single next action. A notice without one is just noise. */
  action?: ReactNode;
  className?: string;
};

const TONE_STYLE: Record<NoticeTone, string> = {
  info: 'border-line bg-surface-2 text-ink',
  ok: 'border-ok/25 bg-ok-soft text-ink',
  warn: 'border-warn/25 bg-warn-soft text-ink',
  crit: 'border-crit/25 bg-crit-soft text-ink',
};

const TONE_ICON_STYLE: Record<NoticeTone, string> = {
  info: 'text-ink-dim',
  ok: 'text-ok',
  warn: 'text-warn',
  crit: 'text-crit',
};

const TONE_ICON = {
  info: Info,
  ok: CheckCircle2,
  warn: AlertTriangle,
  crit: XCircle,
} as const;

/**
 * The one way this flow reports state that is not a happy path.
 *
 * Always INLINE, never a modal: a dialog steals the click the user was making
 * and gets dismissed unread, which is how the legacy three-file reminder
 * ended up being trained away. And always a named reason plus a specific
 * action — "Upload failed" with a spinner still turning is the failure mode
 * this whole surface exists to remove.
 */
export function InlineNotice({
  tone = 'info',
  title,
  children,
  action,
  className,
}: InlineNoticeProps) {
  const Icon = TONE_ICON[tone];

  return (
    <div
      role={tone === 'crit' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-start gap-2.5 rounded-token border px-3 py-2.5',
        TONE_STYLE[tone],
        className,
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', TONE_ICON_STYLE[tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium">{title}</p>
        {children ? <div className="mt-0.5 text-[12px] text-ink-dim">{children}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
