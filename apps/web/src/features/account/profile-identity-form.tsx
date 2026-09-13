import { isApiError, useUpdateProfileMutation } from '@sector/api-client';
import { Button, Input } from '@sector/ui';
import { useState, type FormEvent } from 'react';

import { useAuth } from '@/auth/auth-context';

import {
  profileChanged,
  validateProfile,
  type FieldErrors,
  type ProfileField,
} from './account-form-model';
import { AccountField, FormNotice } from './account-form-parts';

/**
 * Name, and the three identity fields that are not editable here.
 *
 * Email, username and role are shown but read-only. All three are identity
 * keys used elsewhere in the system — the login field accepts either the email
 * or the username, and the role decides every permission — so changing them is
 * not a scan-vault concern even where the server would allow it.
 */
export function ProfileIdentityForm() {
  const auth = useAuth();
  const update = useUpdateProfileMutation();

  const user = auth.user;
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [errors, setErrors] = useState<FieldErrors<ProfileField>>({});
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const changed = profileChanged(user, { firstName, lastName });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);

    const result = validateProfile({ firstName, lastName });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});

    try {
      const updated = await update.mutateAsync(result.value);
      // Merge into the session so the account menu's name changes now rather
      // than on the next reload.
      auth.updateUser({ firstName: updated.firstName, lastName: updated.lastName });
      setFirstName(updated.firstName ?? '');
      setLastName(updated.lastName ?? '');
      setSaved(true);
    } catch {
      // Rendered from update.error below.
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <AccountField label="First name" htmlFor="account-first-name" error={errors.firstName}>
          <Input
            id="account-first-name"
            value={firstName}
            autoComplete="given-name"
            onChange={(event) => setFirstName(event.target.value)}
          />
        </AccountField>

        <AccountField label="Last name" htmlFor="account-last-name" error={errors.lastName}>
          <Input
            id="account-last-name"
            value={lastName}
            autoComplete="family-name"
            onChange={(event) => setLastName(event.target.value)}
          />
        </AccountField>
      </div>

      <dl className="grid gap-3 border-t border-line pt-4 text-body sm:grid-cols-3">
        <ReadOnlyFact label="Email" value={user.email} />
        <ReadOnlyFact label="Username" value={user.userName} />
        <ReadOnlyFact label="Role" value={user.role?.name ?? '—'} className="capitalize" />
      </dl>

      {update.isError ? (
        <FormNotice tone="crit">
          {isApiError(update.error) ? update.error.message : 'Your name could not be saved.'}
        </FormNotice>
      ) : null}

      {saved && !changed ? <FormNotice tone="ok">Your name has been saved.</FormNotice> : null}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!changed || update.isPending}>
          {update.isPending ? 'Saving…' : 'Save name'}
        </Button>
      </div>
    </form>
  );
}

function ReadOnlyFact({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-ink-dim">{label}</dt>
      <dd className={`truncate text-ink ${className ?? ''}`} title={value}>
        {value}
      </dd>
    </div>
  );
}
