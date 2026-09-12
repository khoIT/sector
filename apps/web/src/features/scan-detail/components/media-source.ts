/**
 * What the media stage needs to render one file.
 *
 * Narrower than `MediaFile` on purpose. A saved scan's file arrives with
 * presigned CloudFront URLs; a file in an unsubmitted draft has no scan and so
 * no presign, and exists only as a `Blob` in this browser. The stage's chrome
 * suits both and its source type should not exclude one of them.
 *
 * `MediaFile` satisfies this structurally, so the detail page needs no change.
 */
export type StageSource = {
  id: string;
  filename: string;
  filetype: string;
  /** Null when the bytes are not available — never uploaded, or not local. */
  url: string | null;
  /** Video poster, where one exists. A still is its own thumbnail. */
  urlThumbnail?: string | null;
  /** Bytes, where known. A draft file knows its own size; both do in practice. */
  filesize?: number;
};

/**
 * The files the stage can actually show.
 *
 * A scan keeps its whole file list, including objects whose upload never
 * finished — 17.6% of scans in the local database hold at least one — and
 * those arrive with a null url. Paging through them gave the reviewer blank
 * frames inside a "4 / 7" that counted them as content.
 *
 * They are not hidden from the learner: the files panel beside the stage lists
 * every file with its status, which is where a failed upload belongs.
 */
export function playableSources<T extends StageSource>(files: readonly T[]): T[] {
  return files.filter((file) => Boolean(file.url));
}
