import { Button } from '@sector/ui';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';

import { CREATE_SCAN_PATH, SCAN_VAULT_TITLE, type ScanVaultView } from './scan-list-views';
import { ScanTabBar } from './tabs/scan-tab-bar';
import { visibleScanTabs } from './tabs/scan-tab-model';

export type ScanListShellProps = {
  view: ScanVaultView;
  children: ReactNode;
};

/**
 * The chrome every Scan Vault list shares: the stacked tab set and the Create
 * Scan Study call to action.
 *
 * The app shell's sidebar carries the four sections; this carries the same
 * four as tabs PLUS the sub-tabs the sidebar cannot show — Group and Expert
 * each split into unreviewed and reviewed, and those two are different enough
 * (one is a work queue, the other is a record) that they need to be one click
 * apart with both visible.
 *
 * The <h1> belongs to the shell's topbar, so the heading here starts at <h2>.
 */
export function ScanListShell({ view, children }: ScanListShellProps) {
  const { user, can } = useAuth();
  const tabs = visibleScanTabs(user);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="sr-only">{SCAN_VAULT_TITLE[view]}</h2>

        <div className="min-w-0 flex-1">
          <ScanTabBar tabs={tabs} activeView={view} />
        </div>

        {can('create:scan') ? (
          <Button asChild className="shrink-0">
            <Link to={CREATE_SCAN_PATH}>
              <Plus className="h-4 w-4" aria-hidden />
              Create Scan Study
            </Link>
          </Button>
        ) : null}
      </div>

      {children}
    </div>
  );
}
