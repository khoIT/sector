import { Navigate } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';
import { ForbiddenPage } from '@/auth/forbidden-page';
import { SCAN_VAULT_PATH, type ScanVaultView } from '@/features/scan-list/scan-list-views';
import { canOpenView } from '@/features/scan-list/tabs/scan-tab-model';

export type FirstPermittedRedirectProps = {
  /** In preference order. The first the role may open wins. */
  views: readonly ScanVaultView[];
};

/**
 * Forward a parent URL to the first surface under it this role may actually
 * open.
 *
 * `/scans/group` used to go straight to the unreviewed queue, which 403s a
 * role that may only read the reviewed list — a dead end reached by typing the
 * obvious URL. This is the same rule the sidebar already applies when it picks
 * an entry's destination.
 */
export function FirstPermittedRedirect({ views }: FirstPermittedRedirectProps) {
  const { user } = useAuth();
  const landing = views.find((view) => canOpenView(user, view));

  if (!landing) return <ForbiddenPage />;
  return <Navigate to={SCAN_VAULT_PATH[landing]} replace />;
}
