import { cn } from '@scanvault/ui';
import { Fragment, useState } from 'react';

import { parseReviewMarkdown, type InlineSpan } from './review-markdown';

export type ReviewMarkdownBodyProps = {
  reviewMD?: string | null;
  translatedReviewMD?: string | null;
  /** Language code of the translation, e.g. `vi`. Shown on the toggle. */
  translatedLanguage?: string | null;
  className?: string;
};

/**
 * The AI-assisted part of a review, rendered.
 *
 * The database holds one of these on roughly three reviews in five, and this
 * app showed none of them — the field was parsed and then dropped, so a
 * learner opening a reviewed scan saw the reviewer's short answers and none of
 * the written assessment.
 *
 * Elements are built from the parsed blocks, never from an HTML string, so a
 * review body cannot inject markup.
 */
export function ReviewMarkdownBody({
  reviewMD,
  translatedReviewMD,
  translatedLanguage,
  className,
}: ReviewMarkdownBodyProps) {
  const [showTranslated, setShowTranslated] = useState(false);

  if (!reviewMD && !translatedReviewMD) return null;

  const hasTranslation = Boolean(translatedReviewMD && translatedLanguage);
  const body = (showTranslated && translatedReviewMD ? translatedReviewMD : reviewMD) ?? '';
  const blocks = parseReviewMarkdown(body);

  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
          AI-assisted review
        </h3>

        {hasTranslation ? (
          <div className="flex gap-1" role="group" aria-label="Review language">
            <LanguageTab
              active={!showTranslated}
              onClick={() => setShowTranslated(false)}
              label="Original"
            />
            <LanguageTab
              active={showTranslated}
              onClick={() => setShowTranslated(true)}
              label={(translatedLanguage ?? '').toUpperCase()}
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-token border border-line bg-surface-2 px-3 py-2">
        {blocks.map((block, index) => {
          if (block.kind === 'heading') {
            const Tag = (['h4', 'h5', 'h6'] as const)[block.level - 1] ?? 'h6';
            return (
              <Tag
                key={index}
                className={cn(
                  'mt-3 font-semibold text-ink first:mt-0',
                  block.level === 1 ? 'text-[14px]' : 'text-body',
                )}
              >
                <Spans spans={block.spans} />
              </Tag>
            );
          }

          if (block.kind === 'list') {
            const List = block.ordered ? 'ol' : 'ul';
            return (
              <List
                key={index}
                className={cn(
                  'mt-2 ml-4 space-y-0.5 text-body text-ink first:mt-0',
                  block.ordered ? 'list-decimal' : 'list-disc',
                )}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Spans spans={item} />
                  </li>
                ))}
              </List>
            );
          }

          return (
            <p key={index} className="mt-2 text-body leading-relaxed text-ink first:mt-0">
              <Spans spans={block.spans} />
            </p>
          );
        })}
      </div>
    </section>
  );
}

function LanguageTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-token border px-2 py-0.5 text-[11px] uppercase tracking-wide',
        active
          ? 'border-accent-ink bg-accent-soft text-accent-ink'
          : 'border-line text-ink-dim hover:text-ink',
      )}
    >
      {label}
    </button>
  );
}

function Spans({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, index) => (
        <Fragment key={index}>
          {span.bold ? (
            <strong className="font-semibold">{span.text}</strong>
          ) : span.italic ? (
            <em className="italic">{span.text}</em>
          ) : (
            span.text
          )}
        </Fragment>
      ))}
    </>
  );
}
