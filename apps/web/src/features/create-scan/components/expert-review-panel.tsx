import { useScanReviewCredits } from '@sector/api-client';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, cn } from '@sector/ui';
import { CreditCard, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ExpertReviewChoice } from '../model/draft-types';
import { expertReviewCreditSources, isChoiceDrained } from '../model/expert-review-credit-sources';
import { InlineNotice } from './inline-notice';
import { PurchaseCreditsDialog } from './purchase-credits-dialog';

export type ExpertReviewPanelProps = {
  userId: string;
  userName: string;
  value: ExpertReviewChoice | null;
  onChange: (choice: ExpertReviewChoice | null) => void;
};

/**
 * Expert review, and where the credit comes from.
 *
 * Every pool is listed with its own balance next to the user's, because
 * "3 credits available" pooled across a personal balance and two groups tells
 * a learner nothing about which one a request will actually spend. A pool at
 * zero is shown and disabled rather than hidden, so its emptiness is visible.
 *
 * Buying credits is always available — including, especially, at zero, which
 * is where the legacy flow dead-ended.
 */
export function ExpertReviewPanel({ userId, userName, value, onChange }: ExpertReviewPanelProps) {
  const { t } = useTranslation();
  const { data: credits, isPending, isError, error, refetch } = useScanReviewCredits();
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const sources = useMemo(
    () => (credits ? expertReviewCreditSources(userId, userName, credits) : []),
    [credits, userId, userName],
  );
  const total = sources.reduce((sum, source) => sum + source.credits, 0);

  // A pool that was not empty when chosen can still drain to zero before
  // submit — someone else in the same group spending the last credit, for
  // instance. Selecting an empty pool is already blocked below; this is what
  // un-picks a choice a refetch caught draining AFTER the fact, so the panel
  // stops promising a review no pool can pay for.
  useEffect(() => {
    if (value && isChoiceDrained(sources, value)) onChange(null);
  }, [sources, value, onChange]);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>{t('createScan.expertReviewTitle')}</CardTitle>
          <p className="mt-0.5 text-[12px] text-ink-dim">{t('createScan.expertReviewBlurb')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setPurchaseOpen(true)}>
          <CreditCard className="h-3.5 w-3.5" aria-hidden /> {t('createScan.buyCredits')}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : isError ? (
          <InlineNotice
            tone="crit"
            title={t('createScan.creditsLoadFailedTitle')}
            action={
              <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                {t('createScan.tryAgain')}
              </Button>
            }
          >
            {error instanceof Error ? error.message : t('createScan.creditsLoadFailedFallback')}{' '}
            {t('createScan.creditsLoadFailedBody')}
          </InlineNotice>
        ) : (
          <>
            {total === 0 ? (
              <InlineNotice
                tone="warn"
                title={t('createScan.noCreditsTitle')}
                action={
                  <Button size="sm" onClick={() => setPurchaseOpen(true)}>
                    {t('createScan.buyCredits')}
                  </Button>
                }
              >
                {t('createScan.noCreditsBody')}
              </InlineNotice>
            ) : null}

            <ul className="flex flex-col gap-1.5">
              {sources.map((source) => {
                const selected =
                  value?.accountType === source.accountType && value.accountId === source.accountId;
                const empty = source.credits <= 0;

                return (
                  <li key={source.key}>
                    <button
                      type="button"
                      disabled={empty}
                      aria-pressed={selected}
                      onClick={() =>
                        onChange(
                          selected
                            ? null
                            : {
                                accountType: source.accountType,
                                accountId: source.accountId,
                                label: source.label,
                              },
                        )
                      }
                      className={cn(
                        'flex w-full items-center gap-2 rounded-token border px-3 py-2 text-left transition-colors',
                        'outline-none focus-visible:ring-2 focus-visible:ring-accent-ink',
                        selected
                          ? 'border-accent-ink bg-accent-soft'
                          : 'border-line bg-surface hover:bg-surface-2',
                        empty && 'cursor-not-allowed opacity-60 hover:bg-surface',
                      )}
                    >
                      <Sparkles className="h-4 w-4 shrink-0 text-ink-dim" aria-hidden />
                      <span className="min-w-0 flex-1 text-body text-ink">
                        <span className="block truncate">{source.label}</span>
                        {/* The audit's finding: only the spendable count showed, so
                            neither the user nor a group leader could see how much of
                            the pool had already gone. */}
                        <span className="sv-num block text-[11px] text-ink-dim">
                          {t('createScan.creditsUsedOfTotal', {
                            used: source.used,
                            total: source.total,
                          })}
                        </span>
                      </span>
                      <Badge tone={empty ? 'neutral' : 'ok'}>
                        {t('createScan.creditCount', { count: source.credits })}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>

            {value ? (
              <InlineNotice
                tone="ok"
                title={t('createScan.creditWillBeSpent', { label: value.label })}
                action={
                  <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
                    <X className="h-3.5 w-3.5" aria-hidden /> {t('actions.remove')}
                  </Button>
                }
              >
                {t('createScan.creditSpentOnSubmit')}
              </InlineNotice>
            ) : null}
          </>
        )}
      </CardContent>

      <PurchaseCreditsDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        userId={userId}
        credits={credits}
      />
    </Card>
  );
}
