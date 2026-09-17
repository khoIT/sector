import { createBrowserRouter } from 'react-router-dom';

import { ForgotPasswordPage } from '@/auth/forgot-password-page';
import { InvitationLandingPage } from '@/auth/invitation-landing-page';
import { LoginPage } from '@/auth/login-page';
import { RequireAuth } from '@/auth/require-auth';
import { ResetPasswordPage } from '@/auth/reset-password-page';
import { ResetSentPage } from '@/auth/reset-sent-page';
import { AppShell } from '@/shell/app-shell';

import { appShellRoutes } from './app-shell-routes';
import { RouteErrorPage } from './route-error-page';

/**
 * The route tree.
 *
 *   /login                                    public
 *   /forgot-password                          public — password recovery, step 1
 *   /forgot-password/verify                   public — step 2
 *   /forgot-password/reset                    public — step 3
 *   /group-invitation-confirmation            public — the invitation email's link
 *   <RequireAuth>               redirects to /login?from=<path> when signed out
 *     /  <AppShell>             sidebar + topbar frame, content in <Outlet/>
 *        index                  HomeRoute — the role's dashboard, no redirect
 *        ...scanVaultRoutes     the four tabs, each behind its permission
 *        ...featureRoutes       everything else features register
 *        /dashboard/*, /register/*, /certificates/*, /store-listing/*, /switch-user
 *                               every legacy URL, forwarded or explained
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
 * The five public routes above sit outside `<RequireAuth>` for the same
 * reason `/login` does: a visitor with no session must be able to reach them.
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
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/forgot-password/verify',
    element: <ResetSentPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/forgot-password/reset',
    element: <ResetPasswordPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/group-invitation-confirmation',
    element: <InvitationLandingPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: appShellRoutes,
      },
    ],
  },
]);
