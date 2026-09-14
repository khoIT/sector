import { useGroups, useScanReviewCredits } from '@sector/api-client';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@sector/ui';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';
import { SCAN_VAULT_PATH } from '@/features/scan-list/scan-list-views';
import { useNavBadges } from '@/shell/use-nav-badges';

import { GroupLearningSnapshot } from './group-learning-snapshot';
import { MyLearningPanel } from './my-learning-panel';

/**
 * The scan-reviewer home — the other dashboard the legacy app never shipped.
 * Queue counts reuse `useNavBadges()` (the sidebar's own live counts, not a
 * second query for the same numbers); review credits reuse
 * `useScanReviewCredits()` from the create-scan/expert-review surface. A
 * reviewer who leads no group (the `reviewer-solo` demo account) still gets a
 * full page: the group snapshot section just does not render.
 */
export function ScanReviewerHome() {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const badges = useNavBadges();
  const credits = useScanReviewCredits();
  const groups = useGroups({ user, query: { limit: 1 } });
  const ledGroup = groups.data?.items[0];

  const queueLinks = [
    can('view:scan:pending:expert') && {
      key: 'expert-unreviewed',
      to: SCAN_VAULT_PATH.expert,
      label: t('home.reviewer.expertUnreviewed'),
      count: badges['expert-scans'],
    },
    can('view:scan:reviewed:expert') && {
      key: 'expert-reviewed',
      to: SCAN_VAULT_PATH['expert-reviewed'],
      label: t('home.reviewer.expertReviewed'),
    },
    can('view:scan:pending') && {
      key: 'group-unreviewed',
      to: SCAN_VAULT_PATH.pending,
      label: t('home.reviewer.groupUnreviewed'),
      count: badges['group-scans'],
    },
    can('view:scan:reviewed') && {
      key: 'group-reviewed',
      to: SCAN_VAULT_PATH.reviewed,
      label: t('home.reviewer.groupReviewed'),
    },
  ].filter(Boolean) as { key: string; to: string; label: string; count?: number }[];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">{t('home.reviewer.title')}</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {queueLinks.map((queue) => (
          <Link key={queue.key} to={queue.to} className="block">
            <Card className="h-full transition-colors hover:bg-surface-2">
              <CardContent className="flex items-center justify-between pt-4">
                <span className="text-body text-ink">{queue.label}</span>
                {typeof queue.count === 'number' ? (
                  <Badge tone="accent">{queue.count}</Badge>
                ) : null}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('home.reviewer.credits')}</CardTitle>
        </CardHeader>
        <CardContent>
          {credits.isLoading ? (
            <p className="text-body text-ink-dim">{t('home.reviewer.loading')}</p>
          ) : credits.data ? (
            <div className="flex flex-wrap gap-6">
              <div className="flex flex-col gap-0.5">
                <span className="text-body text-ink-dim">{t('home.reviewer.personalCredits')}</span>
                <span className="sv-num text-[20px] font-semibold text-ink">
                  {credits.data.userCredits}
                </span>
              </div>
              {credits.data.groups.map((group) => (
                <div key={group.groupId} className="flex flex-col gap-0.5">
                  <span className="text-body text-ink-dim">{group.groupName}</span>
                  <span className="sv-num text-[20px] font-semibold text-ink">
                    {group.currentCredits}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-body text-ink-dim">{t('home.reviewer.creditsUnavailable')}</p>
          )}
        </CardContent>
      </Card>

      {ledGroup ? <GroupLearningSnapshot groupId={ledGroup.id} groupName={ledGroup.name} /> : null}

      <div className="h-px bg-line" />
      <MyLearningPanel />
    </div>
  );
}
