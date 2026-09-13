import { Navigate, useLocation } from 'react-router-dom';

import { resolveLegacyPath } from './legacy-route-map';
import { NotFoundPage } from './not-found-page';
import { RetiredSurfacePage } from './retired-surface-page';

/**
 * Lands a legacy dashboard URL on its surface here, or on the page that says
 * the surface was retired.
 *
 * Mounted at every legacy root (see LEGACY_ROOTS) because those URLs outlive
 * the app that minted them: the API writes `/dashboard/scans/my-scans/<id>`
 * into every scan notification, and bookmarks and browser histories keep the
 * rest.
 *
 * `replace`, so Back returns to wherever the user came from rather than
 * bouncing through the old URL again.
 */
export function LegacyRedirect() {
  const { pathname, search } = useLocation();
  const resolution = resolveLegacyPath(pathname);

  if (resolution.kind === 'redirect') return <Navigate to={`${resolution.to}${search}`} replace />;
  if (resolution.kind === 'retired') {
    return <RetiredSurfacePage reason={resolution.reason} alternative={resolution.alternative} />;
  }
  return <NotFoundPage />;
}
