import { useEffect, useRef } from 'react';

import {
  revokeAllObjectUrls,
  syncObjectUrls,
  viewableDraftFiles,
  type ObjectUrlMap,
} from './draft-file-sources';
import type { DraftFile } from './draft-types';

/**
 * Playable sources for the files this browser still holds.
 *
 * The URL map is a ref rather than state on purpose: creating object URLs
 * during render leaks one per frame, which on a 148 MB study is hundreds of
 * megabytes within seconds of typing in the note field. Every URL is revoked
 * when the surface unmounts.
 *
 * Extracted because the viewer moved out of the findings card and into the
 * media rail, while the ordered wizard still keeps it beside the findings.
 */
export function useDraftMediaSources(files: DraftFile[]) {
  const objectUrls = useRef<ObjectUrlMap>(new Map());
  const sources = syncObjectUrls(viewableDraftFiles(files), objectUrls.current);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => revokeAllObjectUrls(urls);
  }, []);

  return sources;
}
