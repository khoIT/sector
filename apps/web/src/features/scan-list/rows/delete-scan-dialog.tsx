import { isApiError, useDeleteScanMutation } from '@sector/api-client';
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

export type DeleteScanDialogProps = {
  scanId: string;
  scanTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Confirm before deleting a scan.
 *
 * The wording avoids promising recoverability. The server soft-deletes, so an
 * engineer can restore the record — but there is no route and no screen that
 * lets the user do it, and telling someone their work is recoverable when they
 * have no way to recover it is worse than telling them nothing.
 */
export function DeleteScanDialog({ scanId, scanTitle, open, onOpenChange }: DeleteScanDialogProps) {
  const { t } = useTranslation();
  const deleteScan = useDeleteScanMutation();

  async function confirm() {
    try {
      await deleteScan.mutateAsync({ scanId });
      onOpenChange(false);
    } catch {
      // Rendered from deleteScan.error below. The dialog stays open so the row
      // is still there and the user can see the scan was not deleted.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (deleteScan.isPending) return;
        if (!next) deleteScan.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
          <DialogDescription>{t('deleteDialog.body', { title: scanTitle })}</DialogDescription>
        </DialogHeader>

        {deleteScan.isError ? (
          <p className="rounded-token border border-crit/25 bg-crit-soft px-3 py-2 text-body text-crit">
            {isApiError(deleteScan.error) ? deleteScan.error.message : t('deleteDialog.error')}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            variant="secondary"
            size="sm"
            disabled={deleteScan.isPending}
            onClick={() => onOpenChange(false)}
          >
            {t('actions.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={deleteScan.isPending}
            onClick={() => void confirm()}
          >
            {deleteScan.isPending ? t('deleteDialog.pending') : t('deleteDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
