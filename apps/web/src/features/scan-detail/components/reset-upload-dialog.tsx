import { isApiError, useResetScanUpload } from '@sector/api-client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sector/ui';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { CREATE_SCAN_PATH } from '@/features/scan-list/scan-list-views';

export type ResetUploadDialogProps = {
  scanId: string;
  scanTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Recover a failed or failed-upload scan by resetting it, then resuming the
 * upload into the SAME study.
 *
 * `PUT /api/scan/:id/reset-upload` puts the scan back to `pending` with
 * `fileCount` at 0 — it does not touch the scan's existing File records or
 * its `fileTotal` — so create-scan's ordinary resume path (matching by
 * filename) is what finishes it: re-adding the same files lets the
 * per-file confirmation find and complete the records already there.
 */
export function ResetUploadDialog({
  scanId,
  scanTitle,
  open,
  onOpenChange,
}: ResetUploadDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resetUpload = useResetScanUpload();

  async function confirm() {
    try {
      await resetUpload.mutateAsync(scanId);
      navigate(`${CREATE_SCAN_PATH}?resetScanId=${scanId}`);
    } catch {
      // Rendered below; the dialog stays open so the error and the retry
      // button are both still on screen.
    }
  }

  return (
    <Dialog open={open} onOpenChange={resetUpload.isPending ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('scanDetail.resetUploadDialogTitle', { title: scanTitle })}</DialogTitle>
          <DialogDescription>{t('scanDetail.resetUploadDialogBody')}</DialogDescription>
        </DialogHeader>

        {resetUpload.isError ? (
          <p className="rounded-token border border-crit/30 bg-crit-soft p-2 text-[12px] text-crit">
            {isApiError(resetUpload.error)
              ? resetUpload.error.message
              : t('scanDetail.resetUploadError')}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={resetUpload.isPending}
          >
            {t('actions.cancel')}
          </Button>
          <Button onClick={() => void confirm()} disabled={resetUpload.isPending}>
            {resetUpload.isPending
              ? t('scanDetail.resetUploadPending')
              : t('scanDetail.resetUploadConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
