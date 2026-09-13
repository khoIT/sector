import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sector/ui';

export type DiscardDraftDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the draft currently holds, as sentences. Empty when it holds nothing. */
  holdings: readonly string[];
  onConfirm: () => void;
};

/**
 * Confirm discarding a draft.
 *
 * A draft can hold a scan type, a set of findings, a clinical note and files
 * that are already in S3, and discarding destroys all of it with nothing to
 * undo it — the same irreversibility Submit gets a confirm for. It was a
 * single unguarded click next to "My scans".
 *
 * The holdings are named rather than counted for the same reason the submit
 * confirm names them: "a draft" is not something anyone can weigh, while "3
 * files in storage, 6 findings answered" is.
 */
export function DiscardDraftDialog({
  open,
  onOpenChange,
  holdings,
  onConfirm,
}: DiscardDraftDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discard this draft?</DialogTitle>
          <DialogDescription>
            {holdings.length === 0
              ? 'Nothing has been entered yet, so nothing is lost.'
              : 'This cannot be undone. The draft holds:'}
          </DialogDescription>
        </DialogHeader>

        {holdings.length > 0 ? (
          <ul className="flex flex-col gap-1 text-body text-ink">
            {holdings.map((holding) => (
              <li key={holding} className="border-b border-line py-1 last:border-b-0">
                {holding}
              </li>
            ))}
          </ul>
        ) : null}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep the draft
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Discard it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
