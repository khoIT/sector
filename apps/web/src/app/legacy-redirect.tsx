import { Navigate, useLocation } from 'react-router-dom';

import { legacyScanPath } from './legacy-paths';
import { NotFoundPage } from './not-found-page';

/**
 * Forwards a legacy dashboard URL to its surface here.
 *
 * Mounted at `/dashboard/*` because the API writes those paths into every scan
 * notification it sends — the submission email links to
 * `/dashboard/scans/my-scans/<id>` — and those links outlive the app that
 * minted them.
 *
 * `replace`, so Back returns to wherever the user came from rather than
 * bouncing through the old URL again.
 */
export function LegacyRedirect() {
  const { pathname, search } = useLocation();
  const target = legacyScanPath(pathname);

  if (!target) return <NotFoundPage />;
  return <Navigate to={`${target}${search}`} replace />;
}
