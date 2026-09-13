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
  cn,
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
 * answer for most of the app's users. Verified against `gusi_prod_mirror`:
 * several hundred leaders across several hundred groups have a live
 * preference today.
 */
export function NotificationPreferences() {
  const { t } = useTranslation();
  const { data, isLoading, isError, isFetching, refetch } = useGroupNotificationPreferences();

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
          <GroupNotificationRow key={group.id} group={group} listIsRefetching={isFetching} />
        ))}
      </CardContent>
    </Card>
  );
}

function GroupNotificationRow({
  group,
  listIsRefetching,
}: {
  group: GroupWithNotificationPreference;
  listIsRefetching: boolean;
}) {
  const { t } = useTranslation();
  const update = useUpdateGroupNotificationPreferenceMutation();
  const savingThisRow = update.isPending && update.variables?.groupId === group.id;
  // Also locked while the list is refetching after ANY row's save: the
  // `group` prop this row renders comes from that list, and a second toggle
  // fired before the refetch lands would build its payload off data the
  // first save already made stale.
  const locked = savingThisRow || listIsRefetching;
  const saveFailed = update.isError && update.variables?.groupId === group.id ? update.error : null;

  function setEnabled(enabled: boolean) {
    // GET /api/group-notifications only reveals `notificationTypes` for a
    // currently-ENABLED row — `getGroupsByUserWithNotifications` filters on
    // `emailNotifications: true` server-side — so a disabled row's `[]` here
    // is not the real stored list, it is what the route hides. Sending it
    // back on re-enable would overwrite the real list with nothing, so this
    // omits `notificationTypes` entirely on exactly that transition and lets
    // the server keep what it already has. Every other write is trustworthy
    // and sends the full set shown on screen.
    const payload =
      enabled && !group.notificationsEnabled
        ? { enableNotification: true }
        : { enableNotification: enabled, notificationTypes: group.notificationTypes };

    update.mutate({ groupId: group.id, payload });
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
            disabled={locked}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          {group.notificationsEnabled ? t('notifications.enabled') : t('notifications.disabled')}
        </label>
      </div>

      {/* The four types only mean anything while the group's notifications
          are on — disabled here rather than merely inert, so it is visible
          rather than a click that quietly does nothing. */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        {NOTIFICATION_TYPES.map((type) => (
          <label
            key={type}
            className={cn(
              'flex items-center gap-1.5 text-body',
              group.notificationsEnabled
                ? 'cursor-pointer text-ink'
                : 'cursor-not-allowed text-ink-dim',
            )}
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--accent)]"
              checked={group.notificationTypes.includes(type)}
              disabled={locked || !group.notificationsEnabled}
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
