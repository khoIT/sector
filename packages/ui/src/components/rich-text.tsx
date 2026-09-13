import { forwardRef, useMemo, type HTMLAttributes } from 'react';

import { cn } from '../lib/cn';
import { sanitizeRichText } from './sanitize-rich-text';

export type RichTextProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'dangerouslySetInnerHTML'
> & {
  /** Raw HTML from the content collections (lesson/topic/question bodies). */
  html: string | null | undefined;
};

/**
 * Renders sanitised WordPress-migrated HTML — lesson bodies, topic bodies,
 * question stems and answer titles. The sanitising POLICY lives in
 * ./sanitize-rich-text.ts, proved against real production bodies in that
 * module's test; this component only wires the policy to `window` and to
 * typography.
 *
 * Not unit tested itself (this package's tests run in a `node` environment,
 * with no DOM renderer) — the policy underneath it is what carries the real
 * risk, and that is where the coverage is.
 */
export const RichText = forwardRef<HTMLDivElement, RichTextProps>(function RichText(
  { html, className, ...props },
  ref,
) {
  const clean = useMemo(() => sanitizeRichText(html), [html]);

  return (
    <div
      ref={ref}
      {...props}
      // `props` spreads FIRST: `className` and `dangerouslySetInnerHTML` must
      // always be the ones that land, never something a caller's own props
      // object happens to carry — the whole point of routing HTML through
      // this component rather than a bare div is that the sanitised body
      // cannot be overridden after the fact.
      className={cn(
        'text-body text-ink [&_a]:text-accent-ink [&_a]:underline [&_a]:underline-offset-2',
        '[&_h1]:text-[17px] [&_h2]:text-[16px] [&_h3]:text-[15px] [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold',
        '[&_h1]:mb-2 [&_h2]:mb-2 [&_h3]:mb-1.5 [&_h1]:mt-3 [&_h2]:mt-3 [&_h3]:mt-2',
        '[&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-ink-dim',
        '[&_code]:rounded-token [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px]',
        '[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-line [&_th]:p-1.5',
        '[&_td]:border [&_td]:border-line [&_td]:p-1.5 [&_img]:max-w-full [&_img]:rounded-token',
        className,
      )}
      // Sanitised above; this is the one place raw HTML enters the app.
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
});
