/**
 * S3 key helpers and the raw presigned-URL PUT.
 *
 * The key the browser sends to /api/scan/v2/upload-presign is concatenated
 * onto a server-side prefix and then signed, so it must survive presigned-URL
 * signing and HTTP intermediaries: no spaces, slashes or unicode.
 */

/** Lowercase, and replace anything outside [a-z0-9.-] with an underscore. */
export function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.-]/g, '_');
}

/** `${timestamp}_${sanitized}` — the filekey segment of an S3 path. */
export function buildScanFilekey(name: string, timestamp: number = Date.now()): string {
  return `${timestamp}_${sanitizeFilename(name)}`;
}

/**
 * Take the trailing filekey out of `storage/{userId}/scan/{batchId}/{filekey}`.
 * Returns the input unchanged when there is no separator.
 */
export function extractFilekey(filepath: string): string {
  const index = filepath.lastIndexOf('/');
  return index === -1 ? filepath : filepath.slice(index + 1);
}

export type PresignedPutResult = {
  /**
   * The S3 ETag for this object or part, quotes stripped. Required to complete
   * a multipart upload; null when the bucket CORS config does not expose the
   * header (`ExposeHeaders: ["ETag"]` must be set).
   */
  etag: string | null;
};

/**
 * PUT bytes straight to a presigned S3 URL.
 *
 * This deliberately bypasses the API client: S3 rejects the Authorization
 * header that the presigned signature already covers, and the response is not
 * an envelope. Call sites used to hand-roll this `fetch` each time.
 */
export async function putToPresignedUrl(
  url: string,
  body: Blob | ArrayBuffer,
  contentType: string,
  signal?: AbortSignal,
): Promise<PresignedPutResult> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
    signal,
  });

  if (!response.ok) {
    throw new Error(`S3 upload failed with ${response.status} ${response.statusText}`);
  }

  const etag = response.headers.get('etag');
  return { etag: etag ? etag.replace(/"/g, '') : null };
}
