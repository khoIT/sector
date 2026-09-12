import { cn } from '@scanvault/ui';
import { BookOpen, FolderClock, Share2, Users2 } from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { ScanVaultView } from '../scan-list-views';
import { tabIdForView, type ScanTab } from './scan-tab-model';

const TAB_ICON: Record<string, ComponentType<{ className?: string }>> = {
  my: BookOpen,
  shared: Share2,
  group: Users2,
  expert: FolderClock,
};

export type ScanTabBarProps = {
  tabs: ScanTab[];
  activeView: ScanVaultView;
};

/**
 * The stacked tab set: a row of top-level pills, and underneath it the
 * sub-tabs of whichever pill is active. Two rows rather than six flat tabs,
 * because "group reviewed" and "expert reviewed" are the same question asked
 * of two different queues — flattening them hid that relationship and made the
 * strip overflow on a laptop.
 *
 * Labels collapse to icons below `lg`, so all four pills stay on one line on a
 * phone without horizontal scrolling.
 */
export function ScanTabBar({ tabs, activeView }: ScanTabBarProps) {
  const { t } = useTranslation();
  const activeTabId = tabIdForView(activeView);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  return (
    <div className="flex flex-col">
      <nav aria-label="Scan Vault sections" className="flex flex-wrap items-end gap-1">
        {tabs.map((tab) => {
          const Icon = TAB_ICON[tab.id] ?? BookOpen;
          const isActive = tab.id === activeTabId;

          return (
            <Link
              key={tab.id}
              to={tab.path}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-t-token border border-b-0 px-3 py-2',
                'text-body font-medium transition-colors outline-none',
                'focus-visible:ring-2 focus-visible:ring-accent-ink',
                isActive
                  ? 'border-line bg-surface text-accent-ink'
                  : 'border-transparent bg-surface-2 text-ink-dim hover:text-ink',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden lg:inline">{t(tab.labelKey)}</span>
              <span className="sr-only lg:hidden">{t(tab.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line" />

      {activeTab && activeTab.subTabs.length > 0 ? (
        <nav
          aria-label={`${t(activeTab.labelKey)} views`}
          className="flex flex-wrap items-center gap-4 border-b border-line px-1 pt-2"
        >
          {activeTab.subTabs.map((subTab) => {
            const isActive = subTab.view === activeView;
            return (
              <Link
                key={subTab.view}
                to={subTab.path}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  '-mb-px border-b-2 px-0.5 pb-1.5 text-body transition-colors outline-none',
                  'focus-visible:ring-2 focus-visible:ring-accent-ink',
                  isActive
                    ? 'border-accent-ink font-medium text-accent-ink'
                    : 'border-transparent text-ink-dim hover:text-ink',
                )}
              >
                {t(subTab.labelKey)}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
