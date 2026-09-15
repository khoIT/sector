import {
  accountKeys,
  isApiError,
  useAccountProfile,
  useUpdateProfileMutation,
  type AccountUser,
} from '@sector/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@sector/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

/**
 * Whether this learner wants reminder email about their assignments.
 *
 * A card of its own rather than a row inside `NotificationPreferences`: that
 * card answers `GET /api/group-notifications`, which returns one row per group
 * the caller LEADS and renders nothing at all for anyone who leads none. Those
 * are exactly the people who receive these reminders, so putting the control
 * there would have hidden it from its own audience.
 *
 * The stored field is an opt-OUT, so the checkbox shown is its inverse: people
 * reason about "send me these", not about "suppress these".
 */
export function AssignmentReminderSetting() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const account = useAccountProfile();
  const update = useUpdateProfileMutation();

  // Absent on every account created before reminders existed, which reads as
  // opted in — the same default the server applies.
  const optedOut = account.data?.assignmentRemindersOptOut === true;

  function setWantsReminders(wants: boolean) {
    update.mutate(
      { assignmentRemindersOptOut: !wants },
      {
        onSuccess: (updated: AccountUser) => {
          // Write the server's answer straight into the cache rather than
          // refetching: the response IS the updated account, so a refetch
          // would be a second round trip to learn what we already hold.
          queryClient.setQueryData(accountKeys.profile(), updated);
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('account.assignmentReminders.title')}</CardTitle>
        <CardDescription>{t('account.assignmentReminders.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {account.isPending ? (
          <Skeleton className="h-9 w-full" />
        ) : account.isError ? (
          <p className="text-body text-crit">{t('account.assignmentReminders.loadError')}</p>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 text-body text-ink">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--accent)]"
              checked={!optedOut}
              disabled={update.isPending}
              onChange={(event) => setWantsReminders(event.target.checked)}
            />
            {t('account.assignmentReminders.label')}
          </label>
        )}

        {/* Said explicitly, because an unsubscribe control that looks global
            makes people hesitate over mail they actually want. */}
        <p className="text-[12px] text-ink-dim">{t('account.assignmentReminders.scopeNote')}</p>

        {update.isError ? (
          <p className="text-[12px] text-crit">
            {isApiError(update.error)
              ? update.error.message
              : t('account.assignmentReminders.saveError')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
