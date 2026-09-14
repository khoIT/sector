import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sector/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Confirm before a write that changes or removes someone's access.
 *
 * The shape is `scan-list/rows/delete-scan-dialog.tsx`, which is the one
 * confirm in this repo that gets the two non-obvious parts right, generalised
 * because group administration needs the same guarantees in three places
 * (role change, member removal, course removal) and three copies of them is
 * how one of them ends up missing a guard:
 *
 *  - `onOpenChange` refuses to close while the request is in flight. Escape,
 *    an overlay click and `DialogContent`'s own close button all route
 *    through it, and the error is rendered INSIDE this content, so a dialog
 *    that unmounts mid-request takes the only report of the failure with it.
 *  - Closing resets the caller's mutation, so a previous failure is not still
 *    on screen the next time the dialog opens for a different row.
 *
 * `description` takes a node rather than a string so a caller can name the
 * subject in bold without this component owning the copy.
 */
export type ConfirmActionDialogProps = {
  open: boolean;
  /** Called only when the dialog may actually open or close. */
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  /** Shown under the description when the last attempt failed. */
  error?: string;
  isPending: boolean;
  pendingLabel: string;
  confirmLabel: string;
  /** `danger` for anything that removes access; `primary` for a change. */
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
};

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  error,
  isPending,
  pendingLabel,
  confirmLabel,
  tone = 'danger',
  onConfirm,
}: ConfirmActionDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="rounded-token border border-crit/25 bg-crit-soft px-3 py-2 text-body text-crit">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {t('actions.cancel')}
          </Button>
          <Button variant={tone} size="sm" disabled={isPending} onClick={onConfirm}>
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
