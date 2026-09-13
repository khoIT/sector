import { Button, Tabs, TabsList, TabsTrigger } from '@sector/ui';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';

import {
  GROUP_ADMINISTRATION_PATH,
  groupAssignmentsPathFor,
  groupCoursesPathFor,
  groupExportsPathFor,
  groupMembersPathFor,
  groupSettingsPathFor,
  type GroupDetailTab,
} from './groups-links';

export type GroupDetailLocationState = { groupName?: string } | null | undefined;

/**
 * The tab bar every one of a group's five surfaces shares.
 *
 * Route-driven, not Radix-state-driven — see the doc comment on `Tabs` in
 * `@sector/ui`: each tab is its own URL (`groups-links.ts`), so a direct link
 * to `/administer/groups/:id/courses` lands correctly and the cold-load sweep
 * can open each tab on its own rather than only ever seeing whichever one a
 * client-side switch defaulted to.
 *
 * `settings` (edit + notification preferences) only renders for a caller who
 * holds `edit:group` — a group leader manages members, courses and
 * assignments but does not necessarily hold the group's own write permission,
 * matching `updateGroupByIdSchema` being gated on `edit:group` specifically
 * rather than the leadership check the member/course/assignment routes use.
 */
export function GroupDetailTabs({
  groupId,
  title,
  active,
}: {
  groupId: string;
  title: string;
  active: GroupDetailTab;
}) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const navigate = useNavigate();

  const tabs: { id: GroupDetailTab; path: string; labelKey: string }[] = [
    { id: 'members', path: groupMembersPathFor(groupId), labelKey: 'groups.tabs.members' },
    { id: 'courses', path: groupCoursesPathFor(groupId), labelKey: 'groups.tabs.courses' },
    {
      id: 'assignments',
      path: groupAssignmentsPathFor(groupId),
      labelKey: 'groups.tabs.assignments',
    },
    { id: 'exports', path: groupExportsPathFor(groupId), labelKey: 'groups.tabs.exports' },
    ...(can('edit:group')
      ? [
          {
            id: 'settings' as const,
            path: groupSettingsPathFor(groupId),
            labelKey: 'groups.tabs.settings',
          },
        ]
      : []),
  ];

  return (
    <div className="mb-3">
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link to={GROUP_ADMINISTRATION_PATH}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          {t('groups.members.backToGroups')}
        </Link>
      </Button>

      <h2 className="mb-2 text-[17px] font-semibold text-ink">{title}</h2>

      <Tabs
        value={active}
        onValueChange={(value) => {
          const target = tabs.find((tab) => tab.id === value);
          if (target) navigate(target.path);
        }}
      >
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {t(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
