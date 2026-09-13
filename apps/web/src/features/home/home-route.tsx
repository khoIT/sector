import { useAuth } from '@/auth/auth-context';

import { resolveHomeDashboard } from './resolve-home-dashboard';

export const HOME_PATH = '/';

/**
 * `/` — the first nav destination. Resolves the signed-in user's role to one
 * of the four dashboards; see `resolveHomeDashboard` for the no-fallthrough
 * rule. `RequireAuth` guarantees `user` is non-null here.
 */
export function HomeRoute() {
  const { user } = useAuth();
  const Dashboard = resolveHomeDashboard(user?.role.slug);
  return <Dashboard />;
}
