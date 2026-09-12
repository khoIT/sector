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
