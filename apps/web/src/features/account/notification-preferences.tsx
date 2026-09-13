import {
  isApiError,
  NOTIFICATION_TYPES,
  useGroupNotificationPreferences,
  useUpdateGroupNotificationPreferenceMutation,
  type GroupWithNotificationPreference,
  type NotificationType,
} from '@sector/api-client';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@sector/ui';
import { useTranslation } from 'react-i18next';

/**
 * Scan-notification preferences, per GROUP — never per account.
 *
 * `GET /api/group-notifications` answers one row per group the caller LEADS,
 * which is why this card renders nothing at all for anyone who leads no
 * group: an empty array is not a loading or error state, it is the correct
 * answer for most of the app's users. 916 leaders across 554 groups have a
 * live preference today (2,363 documents); saving one always sends the full
 * shape for that group's row, never a partial patch, so a type nobody just
 * touched cannot be silently dropped by an optimistic write — there is none.
 */
export function NotificationPreferences() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useGroupNotificationPreferences();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('notifications.title')}</CardTitle>
          <CardDescription>{t('notifications.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('notifications.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            tone="crit"
            title={t('notifications.loadError')}
            action={
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                {t('notifications.retry')}
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  // No group led: not an error, and not a loading state — just nothing to show.
  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('notifications.title')}</CardTitle>
        <CardDescription>{t('notifications.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {data.map((group) => (
          <GroupNotificationRow key={group.id} group={group} />
        ))}
      </CardContent>
    </Card>
  );
}

function GroupNotificationRow({ group }: { group: GroupWithNotificationPreference }) {
  const { t } = useTranslation();
  const update = useUpdateGroupNotificationPreferenceMutation();
  const pending = update.isPending && update.variables?.groupId === group.id;
  const saveFailed = update.isError && update.variables?.groupId === group.id ? update.error : null;

  function setEnabled(enabled: boolean) {
    update.mutate({
      groupId: group.id,
      payload: { enableNotification: enabled, notificationTypes: group.notificationTypes },
    });
  }

  function setType(type: NotificationType, checked: boolean) {
    const next = checked
      ? [...group.notificationTypes, type]
      : group.notificationTypes.filter((existing) => existing !== type);

    update.mutate({
      groupId: group.id,
      payload: { enableNotification: group.notificationsEnabled, notificationTypes: next },
    });
  }

  return (
    <div className="rounded-token border border-line p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink">{group.name}</span>

        <label className="flex cursor-pointer items-center gap-2 text-body text-ink-dim">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[var(--accent)]"
            checked={group.notificationsEnabled}
            disabled={pending}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          {group.notificationsEnabled ? t('notifications.enabled') : t('notifications.disabled')}
        </label>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        {NOTIFICATION_TYPES.map((type) => (
          <label key={type} className="flex cursor-pointer items-center gap-1.5 text-body text-ink">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--accent)]"
              checked={group.notificationTypes.includes(type)}
              disabled={pending}
              onChange={(event) => setType(type, event.target.checked)}
            />
            {t(`notifications.types.${type}`)}
          </label>
        ))}
      </div>

      {saveFailed ? (
        <p className="mt-2 text-[12px] text-crit">
          {isApiError(saveFailed) ? saveFailed.message : t('notifications.saveError')}
        </p>
      ) : null}
    </div>
  );
}
