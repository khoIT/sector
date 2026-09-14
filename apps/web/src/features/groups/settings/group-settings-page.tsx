import { isApiError, useGroupById, useGroupNotificationPreferences } from '@sector/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@sector/ui';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { GroupFormDialog } from '../forms/group-form-dialog';
import { GroupDetailTabs } from '../group-detail-tabs';
import { useGroupDetailTitle } from '../use-group-detail-title';
import { GroupNotificationRow } from './group-notification-row';

/**
 * Edit-group form plus the group's own scan-notification preferences —
 * wiring the Phase-3 card into the group view rather than a second settings
 * surface (see `group-notification-row.tsx`).
 *
 * The notification card only renders when the caller LEADS this specific
 * group: `GET /api/group-notifications` answers the CALLER's own led groups,
 * so an administrator viewing a group someone else leads has no row to show
 * here — matching the server's caller-scoped design, not a client omission.
 */
export function GroupSettingsPage() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const title = useGroupDetailTitle(groupId);

  const group = useGroupById(groupId);
  const notificationPreferences = useGroupNotificationPreferences();

  if (!groupId) return null;

  const ledGroupPreference = notificationPreferences.data?.find((entry) => entry.id === groupId);

  return (
    <section aria-label={title}>
      <GroupDetailTabs groupId={groupId} active="settings" />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('groups.settings.detailsTitle')}</CardTitle>
            <CardDescription>{t('groups.settings.detailsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {group.isPending ? (
              <Skeleton className="h-10 w-40" />
            ) : group.isError ? (
              <EmptyState
                tone="crit"
                icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
                title={t('groups.settings.loadError')}
                description={isApiError(group.error) ? group.error.message : undefined}
              />
            ) : group.data ? (
              <GroupFormDialog mode="edit" group={group.data} />
            ) : null}
          </CardContent>
        </Card>

        {notificationPreferences.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : ledGroupPreference ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('notifications.title')}</CardTitle>
              <CardDescription>{t('notifications.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <GroupNotificationRow
                group={ledGroupPreference}
                listIsRefetching={notificationPreferences.isFetching}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('notifications.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-body text-ink-dim">{t('groups.settings.notLeaderNotice')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
