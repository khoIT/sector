import type { StageSource } from '@/features/scan-detail/components/media-source';

import type { DraftFile } from './draft-types';

/**
 * Draft files as something the media stage can render.
 *
 * Pre-submit there is no scan, so there are no presigned CloudFront URLs — the
 * bytes exist only as the `Blob` on each `DraftFile`. The stage's *chrome* is
 * reusable and its *source* is not, so the source is widened to a shape both a
 * saved `MediaFile` and a local draft file satisfy, and nothing in the stage
 * changes.
 */
export type { StageSource };

/**
 * Object URLs, created once per file and released when the file goes.
 *
 * Creating them during render leaks one blob URL per frame, and on a 148 MB
 * study that is measured in hundreds of megabytes within a few seconds of
 * typing in the note field. So the map is the caller's to own, and this module
 * only ever adds what is missing and revokes what is no longer referenced.
 */
export type ObjectUrlMap = Map<string, string>;

type UrlFactory = {
  create: (blob: Blob) => string;
  revoke: (url: string) => void;
};

const BROWSER_URLS: UrlFactory = {
  create: (blob) => URL.createObjectURL(blob),
  revoke: (url) => URL.revokeObjectURL(url),
};

/**
 * Bring the map in line with the current file list and return the sources.
 *
 * Mutates the map deliberately: it is a long-lived ref owned by the component,
 * and replacing it each render would either revoke URLs still on screen or
 * leak the previous set.
 *
 * A file with no blob — `detached`, restored from a saved manifest — yields
 * `url: null`, which the stage already renders as "File not available". That
 * is the truthful answer: the bytes are genuinely not in this browser.
 */
export function syncObjectUrls(
  files: readonly DraftFile[],
  urls: ObjectUrlMap,
  factory: UrlFactory = BROWSER_URLS,
): StageSource[] {
  const live = new Set<string>();

  const sources = files.map((file) => {
    const blob = file.blob ?? null;

    if (!blob) {
      return {
        id: file.id,
        filename: file.name,
        filetype: file.type,
        url: null,
        filesize: file.size,
      };
    }

    live.add(file.id);
    let url = urls.get(file.id);
    if (!url) {
      url = factory.create(blob);
      urls.set(file.id, url);
    }

    return { id: file.id, filename: file.name, filetype: file.type, url, filesize: file.size };
  });

  // Anything the list no longer carries a blob for is released. This covers
  // removal, cancellation, and the moment an upload finishes and the draft
  // drops the blob to free the memory.
  for (const [id, url] of urls) {
    if (!live.has(id)) {
      factory.revoke(url);
      urls.delete(id);
    }
  }

  return sources;
}

/** Release everything. Call on unmount. */
export function revokeAllObjectUrls(urls: ObjectUrlMap, factory: UrlFactory = BROWSER_URLS): void {
  for (const url of urls.values()) factory.revoke(url);
  urls.clear();
}

/**
 * The files worth putting on a stage.
 *
 * A rejected file failed validation and a cancelled one was abandoned; neither
 * is part of the study, so neither belongs in the strip the learner is reading
 * the study from.
 */
export function viewableDraftFiles(files: readonly DraftFile[]): DraftFile[] {
  return files.filter((file) => file.status !== 'rejected' && file.status !== 'cancelled');
}
