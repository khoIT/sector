import {
  CREDIT_OPTIONS,
  isApiError,
  usePurchaseScanCredits,
  type CreditOption,
  type ScanReviewCredits,
} from '@sector/api-client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@sector/ui';
import { useState } from 'react';

import { InlineNotice } from './inline-notice';
import { useTranslation } from 'react-i18next';

export type PurchaseCreditsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  credits: ScanReviewCredits | undefined;
};

/** The catalogue is a non-empty literal; this keeps that visible to the type. */
const SMALLEST_BUNDLE: CreditOption = CREDIT_OPTIONS[0] ?? {
  credits: 10,
  amount: 150,
  currency: 'USD',
  name: '10 Scan Review Credits',
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

/**
 * Buying expert-review credits.
 *
 * This is the exit from a zero-credit dead end, so it is reachable from the
 * review panel whether or not the user has any credits — the legacy flow put
 * the "Request review" button behind a balance check and left a learner with
 * nothing to click.
 *
 * The server creates a Stripe Checkout session and returns its URL; the
 * browser leaves the app for it. Anything already uploaded is in storage and
 * the draft manifest is in localStorage, so coming back resumes the study.
 */
export function PurchaseCreditsDialog({
  open,
  onOpenChange,
  userId,
  credits,
}: PurchaseCreditsDialogProps) {
  const { t } = useTranslation();
  const purchase = usePurchaseScanCredits();
  const [accountId, setAccountId] = useState<string>(userId);
  const [option, setOption] = useState<CreditOption>(SMALLEST_BUNDLE);

  const groups = credits?.groups ?? [];
  const isGroup = accountId !== userId;

  const start = () => {
    purchase.mutate(
      {
        accountType: isGroup ? 'group' : 'user',
        accountId,
        option,
        // Returning to this exact URL brings the saved draft back with it.
        successUrl: `${window.location.origin}${window.location.pathname}?purchase=success`,
        cancelUrl: `${window.location.origin}${window.location.pathname}?purchase=cancelled`,
      },
      {
        onSuccess: (session) => {
          window.location.assign(session.url);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('createScan.credits.title')}</DialogTitle>
          <DialogDescription>{t('createScan.credits.blurb')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-ink-dim">
              {t('createScan.credits.goTo')}
            </span>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={userId}>{t('createScan.credits.ownBalance')}</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.groupId} value={group.groupId}>
                    {group.groupName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-[12px] font-medium text-ink-dim">
              {t('createScan.credits.bundle')}
            </legend>
            {CREDIT_OPTIONS.map((entry) => {
              const selected = entry.credits === option.credits;
              return (
                <button
                  key={entry.credits}
                  type="button"
                  onClick={() => setOption(entry)}
                  aria-pressed={selected}
                  className={cn(
                    'flex items-center justify-between rounded-token border px-3 py-2 text-left transition-colors',
                    'outline-none focus-visible:ring-2 focus-visible:ring-accent-ink',
                    selected
                      ? 'border-accent-ink bg-accent-soft'
                      : 'border-line bg-surface hover:bg-surface-2',
                  )}
                >
                  <span className="text-body text-ink">{entry.name}</span>
                  <span className="sv-num text-body font-medium text-ink">
                    {formatCurrency(entry.amount, entry.currency)}
                  </span>
                </button>
              );
            })}
          </fieldset>

          {purchase.isError ? (
            <InlineNotice tone="crit" title={t('createScan.credits.error')}>
              {isApiError(purchase.error)
                ? purchase.error.message
                : t('createScan.credits.noResponse')}{' '}
              {t('createScan.credits.errorDetail')}
            </InlineNotice>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('createScan.credits.cancel')}
          </Button>
          <Button onClick={start} disabled={purchase.isPending}>
            {purchase.isPending
              ? t('createScan.credits.opening')
              : t('createScan.credits.continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
