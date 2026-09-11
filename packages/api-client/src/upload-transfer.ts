/**
 * Presigned-URL PUT with real byte-level progress and a working cancel.
 *
 * `putToPresignedUrl` in upload-keys.ts is built on `fetch`, which reports
 * nothing between "sent" and "done": a UI on top of it can only show 0% and
 * then 100%, which for a 400MB clip is a progress bar that lies for four
 * minutes. `XMLHttpRequest` is the only browser API that emits upload progress
 * events, so the transfer path that drives a per-file bar uses it.
 *
 * Both functions talk straight to S3 and never go through ApiClient: the
 * presigned signature already covers the request, S3 rejects an extra
 * Authorization header, and the response carries no envelope.
 */

export type UploadProgress = {
  loaded: number;
  total: number;
  /** 0-100. Falls back to 0 while the total is still unknown. */
  percent: number;
};

export type UploadToPresignedUrlOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
};

export class UploadTransferError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'UploadTransferError';
    this.status = status;
  }
}

/**
 * Resolves with the object's ETag (quotes stripped), or null when the bucket
 * CORS config does not expose the header — `ExposeHeaders: ["ETag"]` must be
 * set for multipart completion to work.
 *
 * Aborting rejects with a DOMException named 'AbortError', matching what
 * `fetch` throws, so callers can use one `isAbortError` check everywhere.
 */
export function uploadToPresignedUrl(
  url: string,
  body: Blob,
  contentType: string,
  options: UploadToPresignedUrlOptions = {},
): Promise<{ etag: string | null }> {
  const { signal, onProgress } = options;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The upload was aborted.', 'AbortError'));
      return;
    }

    const request = new XMLHttpRequest();
    request.open('PUT', url, true);
    request.setRequestHeader('Content-Type', contentType);

    const onAbortSignal = () => request.abort();
    signal?.addEventListener('abort', onAbortSignal, { once: true });

    const cleanup = () => signal?.removeEventListener('abort', onAbortSignal);

    request.upload.onprogress = (event) => {
      if (!onProgress) return;
      const total = event.lengthComputable ? event.total : body.size;
      const percent = total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0;
      onProgress({ loaded: event.loaded, total, percent });
    };

    request.onload = () => {
      cleanup();
      if (request.status < 200 || request.status >= 300) {
        reject(
          new UploadTransferError(
            `Storage rejected the upload (HTTP ${request.status}).`,
            request.status,
          ),
        );
        return;
      }
      onProgress?.({ loaded: body.size, total: body.size, percent: 100 });
      const etag = request.getResponseHeader('etag');
      resolve({ etag: etag ? etag.replace(/"/g, '') : null });
    };

    request.onerror = () => {
      cleanup();
      reject(new UploadTransferError('The network dropped during the upload.', 0));
    };

    request.ontimeout = () => {
      cleanup();
      reject(new UploadTransferError('The upload timed out.', 0));
    };

    request.onabort = () => {
      cleanup();
      reject(new DOMException('The upload was aborted.', 'AbortError'));
    };

    request.send(body);
  });
}
