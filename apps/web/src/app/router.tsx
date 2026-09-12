import { createBrowserRouter } from 'react-router-dom';

import { LoginPage } from '@/auth/login-page';
import { RequireAuth } from '@/auth/require-auth';
import { featureRoutes } from '@/routes/feature-routes';
import { AppShell } from '@/shell/app-shell';

import { LegacyRedirect } from './legacy-redirect';
import { NotFoundPage } from './not-found-page';
import { RouteErrorPage } from './route-error-page';
import { scanVaultRoutes } from './scan-vault-routes';
import { VaultIndexRedirect } from './vault-index-redirect';

/**
 * The route tree.
 *
 *   /login                      public
 *   <RequireAuth>               redirects to /login?from=<path> when signed out
 *     /  <AppShell>             sidebar + topbar frame, content in <Outlet/>
 *        index                  forwards to the first permitted tab
 *        ...scanVaultRoutes     the four tabs, each behind its permission
 *        ...featureRoutes       everything else features register
 *        *                      404, inside the shell
 *
 * There are two mounting points and they are separate on purpose:
 *   - `scanVaultRoutes` (app/scan-vault-routes.tsx) owns the Scan Vault tab
 *     paths and their permission gates; swapping the page behind a tab is one
 *     line there.
 *   - `featureRoutes` (routes/feature-routes.tsx) is where every other feature
 *     surface registers — scan detail, upload, review.
 * Keeping them apart means parallel edits land in different files.
 *
 * The catch-all lives INSIDE the shell, so an unknown URL from a signed-out
 * visitor goes through RequireAuth to /login (and back afterwards) instead of
 * dead-ending on a 404 they cannot act on.
 */
// Annotated rather than inferred: the router type lives in @remix-run/router,
// which is not a direct dependency, and pnpm's isolated layout makes the
// inferred name unportable.
export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <VaultIndexRedirect /> },
          ...scanVaultRoutes,
          ...featureRoutes,
          // The API writes legacy dashboard paths into every scan
          // notification, so those URLs have to resolve here.
          { path: 'dashboard/*', element: <LegacyRedirect /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
