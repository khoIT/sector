import { Dialog, DialogContent, DialogTitle } from '@sector/ui';

import { ScanSharePanel } from './scan-share-panel';

export type ScanShareDialogProps = {
  scanId: string;
  scanTitle: string;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * The share panel, opened from a list row.
 *
 * Deliberately a wrapper rather than a second implementation: sharing has real
 * rules — one row per recipient email, unregistered addresses skipped silently
 * by the server — and two copies of those rules is how the legacy dashboard
 * ended up with six drifting row-action files.
 *
 * The panel renders its own heading, so the dialog's required accessible title
 * is visually hidden rather than duplicated on screen.
 */
export function ScanShareDialog({
  scanId,
  scanTitle,
  currentUserId,
  open,
  onOpenChange,
}: ScanShareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(36rem,calc(100vw-2rem))]">
        <DialogTitle className="sr-only">Share {scanTitle}</DialogTitle>
        <ScanSharePanel scanId={scanId} currentUserId={currentUserId} />
      </DialogContent>
    </Dialog>
  );
}
