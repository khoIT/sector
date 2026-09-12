import type { CompetencyMeasure, UserBasic } from '@scanvault/api-client';
import { userDisplayName } from '@scanvault/api-client';
import { Card, CardContent, CardHeader, CardTitle, StatusPill } from '@scanvault/ui';

import { formatDateTime } from '@/lib/format';

import { ReviewMarkdownBody } from './review-markdown-body';

type ReviewSubject = {
  competencyMeasure?: CompetencyMeasure | null;
  /** The AI-assisted written assessment, and its translation where one exists. */
  reviewMD?: string | null;
  translatedReviewMD?: string | null;
  translatedLanguage?: string | null;
  overAllFeed?: string | null;
  technicalFeed?: string | null;
  teachingPoints?: string | null;
  teachingContent?: string | null;
  customReviews?: { question: string; answer: string }[] | null;
  user: string | UserBasic;
  createdAt: string;
};

type ScanReviewSummaryProps = {
  review: ReviewSubject | null | undefined;
  reviewedAt?: string | null;
  title?: string;
};

/**
 * The submitted review, read-only — what a reviewed scan and a shared scan show
 * in place of the form.
 *
 * `competencyMeasure` can be null OR the empty string on historic rows, so the
 * pill is only rendered for the two real values.
 */
export function ScanReviewSummary({
  review,
  reviewedAt,
  title = 'Review',
}: ScanReviewSummaryProps) {
  if (!review) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-body text-ink-dim">This scan has not been reviewed yet.</p>
        </CardContent>
      </Card>
    );
  }

  const measure = review.competencyMeasure;

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          {measure === 'achieved' || measure === 'not_achieved' ? (
            <StatusPill
              tone={measure === 'achieved' ? 'ok' : 'warn'}
              label={measure === 'achieved' ? 'Achieved' : 'Not achieved'}
            />
          ) : null}
        </div>
        <p className="text-[12px] text-ink-dim">
          {typeof review.user === 'string' ? 'Reviewer' : userDisplayName(review.user)} ·{' '}
          {formatDateTime(reviewedAt ?? review.createdAt)}
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* First, because on the reviews that carry one it is the assessment
            and the short answers are its summary. */}
        <ReviewMarkdownBody
          reviewMD={review.reviewMD}
          translatedReviewMD={review.translatedReviewMD}
          translatedLanguage={review.translatedLanguage}
        />

        <Block label="Overall feedback" value={review.overAllFeed} required />
        <Block label="Technical feedback" value={review.technicalFeed} />
        <Block label="Teaching points" value={review.teachingPoints} />
        <Block label="Teaching content" value={review.teachingContent} />

        {review.customReviews && review.customReviews.length > 0 ? (
          <section>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
              Custom questions
            </h3>
            <dl className="space-y-2">
              {review.customReviews.map((entry, index) => (
                <div key={`${entry.question}-${index}`}>
                  <dt className="text-[12px] font-medium text-ink">{entry.question}</dt>
                  <dd className="whitespace-pre-wrap break-words text-body text-ink-dim">
                    {entry.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Block({
  label,
  value,
  required,
}: {
  label: string;
  value: string | null | undefined;
  required?: boolean;
}) {
  // Optional feedback fields come back as '' rather than absent; an empty
  // heading with nothing under it is noise, so they are dropped entirely.
  if (!value?.trim() && !required) return null;

  return (
    <section>
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
        {label}
      </h3>
      <p className="whitespace-pre-wrap break-words text-body text-ink">
        {value?.trim() || '—'}
      </p>
    </section>
  );
}
