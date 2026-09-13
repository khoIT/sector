import {
  isApiError,
  scanKeys,
  useRequestExpertScanReview,
  userDisplayName,
} from '@sector/api-client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sector/ui';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-context';
import { ExpertReviewPanel } from '@/features/create-scan/components/expert-review-panel';
import type { ExpertReviewChoice } from '@/features/create-scan/model/draft-types';
import { EXPERT_REVIEW_TAG } from '@/features/scan-list/rows/scan-tags';

export type RequestExpertReviewDialogProps = {
  scanId: string;
  scanTitle: string;
  /** The scan's current tags — used to detect an already-successful request. */
  tags: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Request an expert review on a scan that ALREADY exists.
 *
 * Reuses the wizard's own credit-aware panel rather than a second copy of the
 * pool picker: the credit economy (which pool, how much is left, buying more)
 * is exactly the same decision whether it is made before or after Submit.
 *
 * `expert_scan_review` is the tag `POST /api/scan-review/request-expert`
 * applies on success (see submit-draft.ts's `requestReview`), so it doubles
 * as the durable record of "this already happened" — read here instead of
 * re-issuing a request nothing shows was ever made.
 */
export function RequestExpertReviewDialog({
  scanId,
  scanTitle,
  tags,
  open,
  onOpenChange,
}: RequestExpertReviewDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const request = useRequestExpertScanReview();
  const [choice, setChoice] = useState<ExpertReviewChoice | null>(null);

  const alreadyRequested = tags.some((tag) => tag.trim().toLowerCase() === EXPERT_REVIEW_TAG);

  async function confirm() {
    if (!choice) return;
    try {
      await request.mutateAsync({
        scanId,
        type: choice.accountType === 'group' ? 'group' : 'user',
        typeId: choice.accountId,
      });
      // The mutation already invalidates credits and the `my` list root; the
      // scan's own tags also just changed, on every view it could be open in.
      for (const view of ['my', 'pending', 'reviewed', 'expert', 'expert-reviewed'] as const) {
        void queryClient.invalidateQueries({ queryKey: scanKeys.detail(view, scanId) });
      }
      setChoice(null);
      onOpenChange(false);
    } catch {
      // Rendered below via request.isError; the dialog stays open.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!request.isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('scanDetail.requestExpertReviewDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('scanDetail.requestExpertReviewDialogBody', { title: scanTitle })}
          </DialogDescription>
        </DialogHeader>

        {alreadyRequested ? (
          <div className="flex items-start gap-2 rounded-token border border-line bg-surface-2 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
            <p className="text-body text-ink">{t('scanDetail.requestExpertReviewAlready')}</p>
          </div>
        ) : (
          <>
            {user ? (
              <ExpertReviewPanel
                userId={user.id}
                userName={userDisplayName(user)}
                value={choice}
                onChange={setChoice}
              />
            ) : null}

            {request.isError ? (
              <p className="rounded-token border border-crit/30 bg-crit-soft p-2 text-[12px] text-crit">
                {isApiError(request.error)
                  ? request.error.message
                  : t('scanDetail.requestExpertReviewError')}
              </p>
            ) : null}
          </>
        )}

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={request.isPending}
          >
            {t('scanDetail.close')}
          </Button>
          {alreadyRequested ? null : (
            <Button onClick={() => void confirm()} disabled={!choice || request.isPending}>
              {request.isPending
                ? t('scanDetail.requestExpertReviewPending')
                : t('scanDetail.requestExpertReviewSubmit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
