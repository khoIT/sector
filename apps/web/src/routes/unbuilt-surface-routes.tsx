import type { RouteObject } from 'react-router-dom';

import { RequirePermission } from '@/auth/require-auth';

import { UnbuiltSurfacePage } from './unbuilt-surface-page';
import { UNBUILT_SURFACES } from './unbuilt-surfaces';

import { pageMeasure } from './route-measure';

/**
 * A route for every section the rail carries ahead of its surface, so a rail
 * entry always resolves to a page rather than to the 404.
 *
 * Paths and permissions come from ./unbuilt-surfaces.ts, the same table the
 * nav reads, so a gated entry someone cannot see in the rail does not open for
 * them by typed URL either.
 */

/** Children of `/` are matched relatively, so the leading slash comes off. */
function relativePath(path: string): string {
  return path.replace(/^\//, '');
}

export const unbuiltSurfaceRoutes: RouteObject[] = Object.values(UNBUILT_SURFACES).map(
  (surface) => {
    const leaf: RouteObject = {
      path: relativePath(surface.path),
      element: <UnbuiltSurfacePage />,
      handle: pageMeasure('reading'),
    };

    // The gate is a pathless layout route rather than a check inside the page,
    // so it is visible in the route table — the same shape the Scan Vault tab
    // leaves use in app/scan-vault-routes.tsx.
    return surface.permission
      ? { element: <RequirePermission required={surface.permission} />, children: [leaf] }
      : leaf;
  },
);
