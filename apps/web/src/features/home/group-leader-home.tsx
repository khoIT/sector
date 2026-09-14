import { useGroups } from '@sector/api-client';
import { Combobox, EmptyState } from '@sector/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-context';

import { GroupLearningSnapshot } from './group-learning-snapshot';
import { MyLearningPanel } from './my-learning-panel';

/**
 * The group-leader home — one of the two dashboards the legacy app never
 * shipped (both `group_leader` and `scan_reviewer` fell through to the
 * administrator dashboard, member table and all). This one is real: a
 * leader's own led group(s), with a course/scan snapshot and a link to the
 * real members surface, plus their own personal learning underneath.
 */
export function GroupLeaderHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const groups = useGroups({ user, query: { limit: 50 } });
  const groupOptions = useMemo(
    () => (groups.data?.items ?? []).map((group) => ({ value: group.id, label: group.name })),
    [groups.data],
  );
  const activeGroupId = selectedGroupId || groupOptions[0]?.value || '';
  const activeGroup = groups.data?.items.find((group) => group.id === activeGroupId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">{t('home.leader.title')}</h1>
        {groupOptions.length > 1 ? (
          <Combobox
            label={t('home.leader.group')}
            options={groupOptions}
            selected={activeGroupId ? [activeGroupId] : []}
            onSelect={setSelectedGroupId}
            className="w-full sm:w-72"
          />
        ) : null}
      </div>

      {!groups.isLoading && !activeGroupId ? (
        <EmptyState title={t('home.leader.noGroup')} description={t('home.leader.noGroupHint')} />
      ) : activeGroup ? (
        <GroupLearningSnapshot
          groupId={activeGroup.id}
          groupName={activeGroup.name}
          viewerLeadsGroup
        />
      ) : null}

      <div className="h-px bg-line" />
      <MyLearningPanel />
    </div>
  );
}
