import { Navigate } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';
import { ForbiddenPage } from '@/auth/forbidden-page';
// Deep imports, not the feature barrel: the barrel also re-exports the three
// page components, so pulling it in here would drag every list page into the
// entry chunk and undo the lazy() splitting in scan-vault-routes.tsx.
import { SCAN_VAULT_PATH } from '@/features/scan-list/scan-list-views';
import { readLastTab } from '@/features/scan-list/tabs/last-tab-store';
import { canOpenView } from '@/features/scan-list/tabs/scan-tab-model';
import { firstVisibleNavItem } from '@/shell/nav-config';

/**
 * `/` has no content of its own — it forwards to a tab.
 *
 * The tab the user was last on wins, so a reviewer working through the group
 * queue comes back to the group queue instead of their own (usually empty) My
 * Scans. A remembered tab the role has since lost falls through to the first
 * tab they may open, which is why the fallback comes from the same nav config
 * the sidebar reads rather than a hard-coded /scans/my.
 */
export function VaultIndexRedirect() {
  const { user } = useAuth();

  const remembered = readLastTab(user?.id);
  if (remembered && canOpenView(user, remembered)) {
    return <Navigate to={SCAN_VAULT_PATH[remembered]} replace />;
  }

  const landing = user ? firstVisibleNavItem(user) : undefined;

  // RequireAuth guarantees a user above this route, so a missing landing means
  // a role with no Scan Vault surface at all — say so rather than bouncing.
  if (!landing) return <ForbiddenPage required={['view:scan']} />;

  return <Navigate to={landing.path} replace />;
}
