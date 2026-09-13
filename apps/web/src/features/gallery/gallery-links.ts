/**
 * URL for the pathology gallery — pinned by `app/legacy-route-map.ts`'s
 * `SECTOR_PATH.gallery`, which the legacy `/dashboard/pathology-gallery`
 * redirect already targets. Do not change this segment without changing it
 * there too.
 */
export const GALLERY_PATH = '/learn/gallery';

function stripLeadingSlash(path: string): string {
  return path.replace(/^\//, '');
}

/** Route path for the gallery, relative to the app root. */
export const GALLERY_ROUTE_PATH = stripLeadingSlash(GALLERY_PATH);
