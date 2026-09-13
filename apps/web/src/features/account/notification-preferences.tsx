import { useGroupNotificationPreferences } from '@sector/api-client';
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

import { GroupNotificationRow } from '@/features/groups/settings/group-notification-row';

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
