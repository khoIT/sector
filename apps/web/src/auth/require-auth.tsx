import { Skeleton } from '@sector/ui';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './auth-context';
import { ForbiddenPage } from './forbidden-page';
import { loginPathFor } from './safe-redirect';

/**
 * Session guard. Mount it as a pathless layout route above everything that
 * needs a signed-in user.
 *
 * Three states, and the middle one matters: on boot the provider spends one
 * `GET /api/me` restoring a stored refresh token. Redirecting during that
 * window would bounce a deep link to /login and back, so `restoring` renders
 * the shell's skeleton instead.
 */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'restoring') {
    return (
      <div className="min-h-dvh bg-bg px-4 py-10">
        <div className="mx-auto w-full max-w-5xl" aria-busy="true" aria-live="polite">
          <span className="sr-only">Restoring your session…</span>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to={loginPathFor(location)} replace />;
  }

  return <Outlet />;
}

export type RequirePermissionProps = {
  /** Every permission listed must be held. */
  required: string | string[];
  /**
   * What to render instead of the route when the check fails. Defaults to the
   * 403 page — NOT a redirect. A silent bounce to the index hides the reason
   * and looks like a broken link; the page names the missing permission.
   */
  fallback?: ReactNode;
};

/**
 * Permission guard for a route subtree. Wrap routes in this as a pathless
 * layout route rather than re-reading `user.role.permissions` inline, so the
 * gate is visible in the route table and cannot be forgotten on a new page.
 *
 * The server enforces the same strings (a bare fetch still 403s); this exists
 * so the user sees a real page rather than an empty one.
 */
export function RequirePermission({ required, fallback }: RequirePermissionProps) {
  const { can } = useAuth();

  if (!can(required)) {
    const list = Array.isArray(required) ? required : [required];
    return <>{fallback ?? <ForbiddenPage required={list} />}</>;
  }

  return <Outlet />;
}
