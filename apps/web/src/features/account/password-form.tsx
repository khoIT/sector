import { isApiError, useUpdatePasswordMutation } from '@sector/api-client';
import { Button, Input } from '@sector/ui';
import { useState, type FormEvent } from 'react';

import { AccountField, FormNotice } from './account-form-parts';
import { validatePassword, type FieldErrors, type PasswordField } from './account-form-model';
import { useTranslation } from 'react-i18next';

const EMPTY = { oldPassword: '', newPassword: '', confirmNewPassword: '' };

/**
 * Change your own password.
 *
 * The session survives it. `updatePassword` on the server hashes and saves and
 * does nothing else — no token rotation, no session table — so the user stays
 * signed in and is told so, rather than being bounced to the login page for a
 * change that did not end their session.
 */
export function PasswordForm() {
  const update = useUpdatePasswordMutation();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<PasswordField>>({});
  const [changed, setChanged] = useState(false);
  const { t } = useTranslation();

  function set(field: PasswordField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setChanged(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    const result = validatePassword(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});

    try {
      await update.mutateAsync(result.value);
      setValues(EMPTY);
      setChanged(true);
    } catch {
      // Rendered from update.error below. The typed values stay so the user
      // can correct one field rather than retyping all three.
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <AccountField
        label={t('account.password.current')}
        htmlFor="account-old-password"
        error={errors.oldPassword}
      >
        <Input
          id="account-old-password"
          type="password"
          autoComplete="current-password"
          value={values.oldPassword}
          onChange={(event) => set('oldPassword', event.target.value)}
        />
      </AccountField>

      <div className="grid gap-4 sm:grid-cols-2">
        <AccountField
          label={t('account.password.new')}
          htmlFor="account-new-password"
          error={errors.newPassword}
        >
          <Input
            id="account-new-password"
            type="password"
            autoComplete="new-password"
            value={values.newPassword}
            onChange={(event) => set('newPassword', event.target.value)}
          />
        </AccountField>

        <AccountField
          label={t('account.password.confirm')}
          htmlFor="account-confirm-password"
          error={errors.confirmNewPassword}
        >
          <Input
            id="account-confirm-password"
            type="password"
            autoComplete="new-password"
            value={values.confirmNewPassword}
            onChange={(event) => set('confirmNewPassword', event.target.value)}
          />
        </AccountField>
      </div>

      {update.isError ? (
        <FormNotice tone="crit">
          {isApiError(update.error) ? update.error.message : t('account.password.error')}
        </FormNotice>
      ) : null}

      {changed ? <FormNotice tone="ok">{t('account.password.changed')}</FormNotice> : null}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={update.isPending}>
          {update.isPending ? t('account.password.changing') : t('account.password.change')}
        </Button>
      </div>
    </form>
  );
}
