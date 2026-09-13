import { isApiError, useDeleteAccountMutation } from '@sector/api-client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from '@sector/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';

/**
 * Delete the signed-in account.
 *
 * `deleteAccount` in `account.controller.ts` SOFT-deletes: it flips `status`
 * to `deleted` and suffixes `userName`/`email` with `_deleted_<timestamp>`. It
 * does NOT remove the user's scans, reviews or group memberships — those rows
 * keep this user id forever. The warning below says exactly that rather than
 * the more common "all your data will be permanently erased", which would be
 * false here.
 *
 * The typed-email confirmation is enforced twice: once here so the button
 * cannot be clicked by accident, and again server-side (`email !== user.email`
 * throws 400 "Email not matched") — the client check is a courtesy, not the
 * real gate.
 */
export function DeleteAccountDialog() {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const deleteAccount = useDeleteAccountMutation();

  const [open, setOpen] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');

  const email = auth.user?.email ?? '';
  const canConfirm = typedEmail.trim().length > 0 && typedEmail.trim() === email;

  function handleOpenChange(next: boolean) {
    if (deleteAccount.isPending) return;
    if (!next) {
      setTypedEmail('');
      deleteAccount.reset();
    }
    setOpen(next);
  }

  async function confirm() {
    if (!canConfirm) return;

    try {
      await deleteAccount.mutateAsync({ email });
      // signOut also purges local draft files — deleting the account without
      // it would leave this browser holding bytes for an id that no longer
      // resolves to anyone.
      auth.signOut();
      navigate('/login', { replace: true, state: { notice: t('deleteAccount.successNotice') } });
    } catch {
      // Rendered from deleteAccount.error below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="danger" size="sm">
          {t('deleteAccount.trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteAccount.title')}</DialogTitle>
          <DialogDescription>{t('deleteAccount.warning')}</DialogDescription>
        </DialogHeader>

        <Input
          label={t('deleteAccount.confirmLabel', { email })}
          name="confirmEmail"
          type="email"
          autoComplete="off"
          value={typedEmail}
          onChange={(event) => setTypedEmail(event.target.value)}
        />

        {deleteAccount.isError ? (
          <p className="rounded-token border border-crit/25 bg-crit-soft px-3 py-2 text-body text-crit">
            {isApiError(deleteAccount.error)
              ? deleteAccount.error.message
              : t('deleteAccount.error')}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            variant="secondary"
            size="sm"
            disabled={deleteAccount.isPending}
            onClick={() => handleOpenChange(false)}
          >
            {t('actions.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!canConfirm || deleteAccount.isPending}
            onClick={() => void confirm()}
          >
            {deleteAccount.isPending ? t('deleteAccount.pending') : t('deleteAccount.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
