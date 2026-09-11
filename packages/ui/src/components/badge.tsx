import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * Tone is deliberately domain-free. Map a scan status to a tone with
 * `scanStatusTone()` from @scanvault/api-client so the mapping lives in one
 * place and the UI package stays free of scan vocabulary.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface-2 text-ink-dim',
        accent: 'border-accent-ink/25 bg-accent-soft text-accent-ink',
        ok: 'border-ok/25 bg-ok-soft text-ok',
        warn: 'border-warn/25 bg-warn-soft text-warn',
        crit: 'border-crit/25 bg-crit-soft text-crit',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone, ...props },
  ref,
) {
  return <span ref={ref} className={cn(badgeVariants({ tone }), className)} {...props} />;
});

export type StatusPillProps = Omit<BadgeProps, 'children'> & {
  /** Human label. Pass the already-localised string. */
  label: ReactNode;
  /** Draw the leading dot. Off for pills that already carry an icon. */
  dot?: boolean;
};

/**
 * A Badge with a leading tone dot. The dot uses currentColor so it always
 * matches the label and needs no extra token.
 */
export const StatusPill = forwardRef<HTMLSpanElement, StatusPillProps>(function StatusPill(
  { label, dot = true, tone, className, ...props },
  ref,
) {
  return (
    <Badge ref={ref} tone={tone} className={className} {...props}>
      {dot ? (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80"
        />
      ) : null}
      {label}
    </Badge>
  );
});

export { badgeVariants };
