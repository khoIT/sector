import type { CompetencyMeasure, UserBasic } from '@sector/api-client';
import { userDisplayName } from '@sector/api-client';
import { Card, CardContent, CardHeader, CardTitle, StatusPill } from '@sector/ui';

import { formatDateTime } from '@/lib/format';

import { ReviewMarkdownBody } from './review-markdown-body';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  if (!review) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-body text-ink-dim">{t('scanDetail.summary.notReviewed')}</p>
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
              label={
                measure === 'achieved'
                  ? t('scanDetail.review.achieved')
                  : t('scanDetail.review.notAchieved')
              }
            />
          ) : null}
        </div>
        <p className="text-[12px] text-ink-dim">
          {typeof review.user === 'string'
            ? t('scanDetail.summary.reviewer')
            : userDisplayName(review.user)}{' '}
          · {formatDateTime(reviewedAt ?? review.createdAt)}
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

        <Block label={t('scanDetail.summary.overall')} value={review.overAllFeed} required />
        <Block label={t('scanDetail.summary.technical')} value={review.technicalFeed} />
        <Block label={t('scanDetail.summary.teaching')} value={review.teachingPoints} />
        <Block label={t('scanDetail.summary.teachingContent')} value={review.teachingContent} />

        {review.customReviews && review.customReviews.length > 0 ? (
          <section>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
              {t('scanDetail.summary.customQuestions')}
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
      <p className="whitespace-pre-wrap break-words text-body text-ink">{value?.trim() || '—'}</p>
    </section>
  );
}
