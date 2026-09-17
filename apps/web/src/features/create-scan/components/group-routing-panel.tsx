import { useScanUserGroups, type UserGroup } from '@sector/api-client';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, cn } from '@sector/ui';
import { Check, Users } from 'lucide-react';

import { defaultGroupCohort, isWiderThanCohort } from '../model/group-cohort';
import { InlineNotice } from './inline-notice';
import { useTranslation } from 'react-i18next';

export type GroupRoutingPanelProps = {
  /** null means untouched: the default cohort applies. */
  selected: string[] | null;
  onChange: (groupIds: string[]) => void;
};

/**
 * Who gets to review this study.
 *
 * The default is the user's most specific cohort, not every group they belong
 * to. The wider groups are still one click away and are labelled as such, so
 * broadcasting is a decision rather than the thing that happens if you do not
 * look.
 *
 * Group routing is applied at scan creation and CANNOT be changed afterwards —
 * the API has no route that adds a group to an existing scan — which is why
 * this step exists before submission rather than on the scan detail page.
 */
export function GroupRoutingPanel({ selected, onChange }: GroupRoutingPanelProps) {
  const { t } = useTranslation();
  const { data: groups, isPending, isError, error, refetch } = useScanUserGroups();

  const effective = selected ?? defaultGroupCohort(groups);

  const toggle = (group: UserGroup) => {
    const next = effective.includes(group.id)
      ? effective.filter((id) => id !== group.id)
      : [...effective, group.id];
    onChange(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('createScan.groups.title')}</CardTitle>
        <p className="mt-0.5 text-[12px] text-ink-dim">{t('createScan.groups.blurb')}</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : isError ? (
          <InlineNotice
            tone="crit"
            title={t('createScan.groups.loadError')}
            action={
              <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                {t('createScan.groups.retry')}
              </Button>
            }
          >
            {error instanceof Error ? error.message : t('createScan.groups.requestFailed')}{' '}
            {t('createScan.groups.loadErrorDetail')}
          </InlineNotice>
        ) : (groups ?? []).length === 0 ? (
          <InlineNotice tone="info" title={t('createScan.groups.noneTitle')}>
            {t('createScan.groups.noneDetail')}
          </InlineNotice>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {(groups ?? []).map((group) => {
              const isSelected = effective.includes(group.id);
              const wide = isWiderThanCohort(group, groups);

              return (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => toggle(group)}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-token border px-3 py-2 text-left transition-colors',
                      'outline-none focus-visible:ring-2 focus-visible:ring-accent-ink',
                      isSelected
                        ? 'border-accent-ink bg-accent-soft'
                        : 'border-line bg-surface hover:bg-surface-2',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border',
                        isSelected ? 'border-accent-ink bg-accent-ink' : 'border-line bg-surface',
                      )}
                    >
                      {isSelected ? <Check className="h-3 w-3 text-surface" /> : null}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body text-ink">{group.name}</span>
                      {group.parent ? (
                        <span className="block truncate text-[11px] text-ink-dim">
                          {t('createScan.groups.in')} {group.parent.name}
                        </span>
                      ) : null}
                    </span>

                    {wide ? (
                      <Badge tone="neutral" title={t('createScan.groups.parentGroup')}>
                        <Users className="h-3 w-3" aria-hidden />{' '}
                        {t('createScan.groups.widerGroup')}
                      </Badge>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
