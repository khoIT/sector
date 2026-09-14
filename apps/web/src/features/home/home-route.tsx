import { useAuth } from '@/auth/auth-context';

import { resolveHomeDashboard } from './resolve-home-dashboard';

export const HOME_PATH = '/';

/**
 * `/` — the first nav destination. Resolves the signed-in user to one of the
 * four dashboards: full access first, then role slug. See
 * `resolveHomeDashboard` for why the permission check comes first.
 * `RequireAuth` guarantees `user` is non-null here.
 */
export function HomeRoute() {
  const { user } = useAuth();
  const Dashboard = resolveHomeDashboard(user);
  return <Dashboard />;
}
