import { useGroupById } from '@sector/api-client';
import { useTranslation } from 'react-i18next';

/**
 * The group's name, for the heading `GroupDetailTabs` renders and for the
 * `aria-label` each tab's own `<section>` carries.
 *
 * Resolved from the route's `:groupId` rather than from `location.state`: the
 * state channel only survived the first navigation into the section, so every
 * tab switch and every direct link fell back to a generic string. React Query
 * de-duplicates this across the tab bar and the settings tab, so the five
 * surfaces share one request.
 */
export function useGroupDetailTitle(groupId: string | undefined): string {
  const { t } = useTranslation();
  const group = useGroupById(groupId);
  return group.data?.name ?? t('groups.detail.untitled');
}
