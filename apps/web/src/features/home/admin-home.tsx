import { useGroups } from '@sector/api-client';
import { Button, Combobox, EmptyState } from '@sector/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';
import { GROUP_ADMINISTRATION_PATH } from '@/features/groups/groups-links';

import { GroupLearningSnapshot } from './group-learning-snapshot';
import { MyLearningPanel } from './my-learning-panel';

/**
 * The administrator home. Unlike the legacy dashboard, this is not where a
 * group's member roster lives — that is `GROUP_ADMINISTRATION_PATH`
 * (Phase 8), linked below. This page is the org-wide snapshot: pick any
 * group, see its course/scan standing, then drop into the real group surface
 * for anything beyond looking.
 */
export function AdminHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Full-access, so useGroups reads GET /api/groups — every group, not just
  // one this account leads. Capped at 100 for the picker; searching beyond
  // that is what the Group Administration index (linked below) is for.
  const groups = useGroups({ user, query: { limit: 100 } });
  const groupOptions = useMemo(
    () => (groups.data?.items ?? []).map((group) => ({ value: group.id, label: group.name })),
    [groups.data],
  );
  const activeGroupId = selectedGroupId || groupOptions[0]?.value || '';
  const activeGroup = groups.data?.items.find((group) => group.id === activeGroupId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">{t('home.admin.title')}</h1>
        <Button asChild variant="secondary" size="sm">
          <Link to={GROUP_ADMINISTRATION_PATH}>{t('home.admin.manageGroups')}</Link>
        </Button>
      </div>

      <Combobox
        label={t('home.admin.group')}
        options={groupOptions}
        selected={activeGroupId ? [activeGroupId] : []}
        onSelect={setSelectedGroupId}
        placeholder={t('home.admin.selectGroup')}
        loading={groups.isLoading}
        className="w-full sm:w-80"
      />

      {!groups.isLoading && !activeGroupId ? (
        <EmptyState title={t('home.admin.noGroups')} description={t('home.admin.noGroupsHint')} />
      ) : activeGroup ? (
        <GroupLearningSnapshot groupId={activeGroup.id} groupName={activeGroup.name} />
      ) : null}

      <div className="h-px bg-line" />
      <MyLearningPanel />
    </div>
  );
}
