import { Dialog, DialogContent, DialogTitle } from '@sector/ui';

import { ScanNotesThread } from './scan-notes-thread';

export type ScanNotesDialogProps = {
  scanId: string;
  scanTitle: string;
  canRead: boolean;
  canAdd: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * The note thread, opened from a list row.
 *
 * Same reasoning as the share dialog: one implementation of the thread, two
 * places it can be mounted. The thread reads through the standalone notes
 * route, so opening it from a row shows the same conversation the scan page
 * does, refreshed.
 */
export function ScanNotesDialog({
  scanId,
  scanTitle,
  canRead,
  canAdd,
  open,
  onOpenChange,
}: ScanNotesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(36rem,calc(100vw-2rem))]">
        <DialogTitle className="sr-only">Comments on {scanTitle}</DialogTitle>
        <ScanNotesThread scanId={scanId} canRead={canRead} canAdd={canAdd} />
      </DialogContent>
    </Dialog>
  );
}
