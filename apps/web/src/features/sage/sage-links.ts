/**
 * URL for the Sage AI frame — pinned by `app/legacy-route-map.ts`'s
 * `SECTOR_PATH.sage`, which the legacy `/dashboard/sage-ai` redirect already
 * targets. Do not change this segment without changing it there too.
 */
export const SAGE_PATH = '/learn/sage';

/** Route path for the Sage frame, relative to the app root. */
export const SAGE_ROUTE_PATH = SAGE_PATH.replace(/^\//, '');
