import { useScanReviewCredits, type ScanReviewCredits } from '@sector/api-client';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, cn } from '@sector/ui';
import { CreditCard, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

import type { ExpertReviewChoice } from '../model/draft-types';
import { InlineNotice } from './inline-notice';
import { PurchaseCreditsDialog } from './purchase-credits-dialog';

export type ExpertReviewPanelProps = {
  userId: string;
  userName: string;
  value: ExpertReviewChoice | null;
  onChange: (choice: ExpertReviewChoice | null) => void;
};

type CreditSource = {
  key: string;
  accountType: 'user' | 'group';
  accountId: string;
  label: string;
  credits: number;
};

function creditSources(
  userId: string,
  userName: string,
  credits: ScanReviewCredits,
): CreditSource[] {
  return [
    {
      key: `user:${userId}`,
      accountType: 'user',
      accountId: userId,
      label: `${userName} (your balance)`,
      credits: credits.userCredits,
    },
    ...credits.groups.map((group) => ({
      key: `group:${group.groupId}`,
      accountType: 'group' as const,
      accountId: group.groupId,
      label: group.groupName,
      credits: group.currentCredits,
    })),
  ];
}

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
  const { data: credits, isPending, isError, error, refetch } = useScanReviewCredits();
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const sources = credits ? creditSources(userId, userName, credits) : [];
  const total = sources.reduce((sum, source) => sum + source.credits, 0);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>Expert review</CardTitle>
          <p className="mt-0.5 text-[12px] text-ink-dim">
            Optional. A GUSI expert reviews the study in addition to any group reviewers. One credit
            per review.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setPurchaseOpen(true)}>
          <CreditCard className="h-3.5 w-3.5" aria-hidden /> Buy credits
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : isError ? (
          <InlineNotice
            tone="crit"
            title="Credit balances could not be loaded"
            action={
              <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          >
            {error instanceof Error ? error.message : 'The request failed.'} You can submit the
            study without an expert review and request one later from the scan.
          </InlineNotice>
        ) : (
          <>
            {total === 0 ? (
              <InlineNotice
                tone="warn"
                title="No expert review credits available"
                action={
                  <Button size="sm" onClick={() => setPurchaseOpen(true)}>
                    Buy credits
                  </Button>
                }
              >
                Neither your balance nor any of your groups has a credit left. The study will be
                submitted to your groups as usual — expert review can be requested later once
                credits are topped up.
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
                      <span className="min-w-0 flex-1 truncate text-body text-ink">
                        {source.label}
                      </span>
                      <Badge tone={empty ? 'neutral' : 'ok'}>
                        <span className="sv-num">{source.credits}</span>
                        {source.credits === 1 ? ' credit' : ' credits'}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>

            {value ? (
              <InlineNotice
                tone="ok"
                title={`One credit from ${value.label} will be spent on submit`}
                action={
                  <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
                    <X className="h-3.5 w-3.5" aria-hidden /> Remove
                  </Button>
                }
              >
                The credit is only spent once the study is submitted. If the request fails you will
                be told, and the study is saved either way.
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
