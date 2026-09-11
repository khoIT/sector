import type { ApiClient } from './client';
import {
  multipartUploadComplete,
  multipartUploadInit,
  multipartUploadPart,
  uploadPresign,
} from './endpoints/scan-upload';
import { uploadToPresignedUrl, type UploadProgress } from './upload-transfer';

/**
 * One scan object, uploaded whole or in parts.
 *
 * A single-shot PUT has no restart point: a 400MB clip that drops at 95% is
 * 380MB thrown away, and on a clinic connection that is the common case rather
 * than the edge one. S3 multipart gives each part its own retry, so a failure
 * costs one part instead of the file.
 *
 * The parts already accepted live in a `MultipartSession` the caller holds, so
 * retrying a failed file resumes from the first part that never landed. The
 * session cannot outlive the page: reload drops the Blob, and without the
 * bytes there is nothing to resume from — the wizard already handles that by
 * asking for the file again.
 */

/** S3 rejects any part but the last below 5 MiB. 8 keeps the part count sane. */
export const MULTIPART_PART_SIZE = 8 * 1024 * 1024;

/** Below this a single PUT is fewer round trips than init + part + complete. */
export const MULTIPART_THRESHOLD = 16 * 1024 * 1024;

/** Parts in flight for ONE file. Files are already uploaded concurrently. */
const MAX_CONCURRENT_PARTS = 3;

export type MultipartSession = {
  uploadId: string;
  key: string;
  /** partNumber (1-based) → ETag, for every part S3 has accepted. */
  etags: Record<number, string>;
};

export type UploadScanObjectOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
  /** A session from an earlier attempt at this same file, to resume from. */
  session?: MultipartSession | null;
  /** Called as soon as a session exists, and after every accepted part. */
  onSession?: (session: MultipartSession) => void;
};

export class MultipartEtagError extends Error {
  constructor(partNumber: number) {
    super(
      `Storage did not return an ETag for part ${partNumber}. The bucket CORS ` +
        'configuration must list ETag under ExposeHeaders for multipart upload to complete.',
    );
    this.name = 'MultipartEtagError';
  }
}

export function shouldUseMultipart(size: number): boolean {
  return size > MULTIPART_THRESHOLD;
}

export async function uploadScanObject(
  client: ApiClient,
  input: { scanId: string; key: string; blob: Blob; contentType: string },
  options: UploadScanObjectOptions = {},
): Promise<{ key: string }> {
  if (!shouldUseMultipart(input.blob.size)) {
    return uploadSingleShot(client, input, options);
  }
  return uploadInParts(client, input, options);
}

async function uploadSingleShot(
  client: ApiClient,
  input: { scanId: string; key: string; blob: Blob; contentType: string },
  options: UploadScanObjectOptions,
): Promise<{ key: string }> {
  const presigned = await uploadPresign(
    client,
    { scanId: input.scanId, key: input.key, contentType: input.contentType },
    options.signal,
  );

  await uploadToPresignedUrl(presigned.url, input.blob, input.contentType, {
    signal: options.signal,
    onProgress: options.onProgress,
  });

  return { key: presigned.key };
}

async function uploadInParts(
  client: ApiClient,
  input: { scanId: string; key: string; blob: Blob; contentType: string },
  options: UploadScanObjectOptions,
): Promise<{ key: string }> {
  const total = input.blob.size;
  const partCount = Math.ceil(total / MULTIPART_PART_SIZE);

  // `presignedUrls` comes back from init when totalParts is sent, which saves
  // one round trip per part. It is optional on the response, so a per-part
  // presign stays the fallback rather than the assumption.
  let session = options.session ?? null;
  let presignedUrls: string[] | undefined;

  if (!session) {
    const init = await multipartUploadInit(
      client,
      {
        scanId: input.scanId,
        key: input.key,
        contentType: input.contentType,
        totalParts: partCount,
      },
      options.signal,
    );
    session = { uploadId: init.uploadId, key: init.key, etags: {} };
    presignedUrls = init.presignedUrls;
    options.onSession?.(session);
  }

  const activeSession = session;
  const loadedByPart = new Map<number, number>();

  // Parts that survived an earlier attempt are already on the server; counting
  // them keeps a resumed upload from restarting its progress bar at zero.
  for (const [partNumber, _etag] of Object.entries(activeSession.etags)) {
    loadedByPart.set(Number(partNumber), sizeOfPart(Number(partNumber), partCount, total));
  }

  const report = () => {
    if (!options.onProgress) return;
    let loaded = 0;
    for (const value of loadedByPart.values()) loaded += value;
    options.onProgress({
      loaded,
      total,
      percent: total === 0 ? 0 : Math.min(100, Math.round((loaded / total) * 100)),
    });
  };
  report();

  const pending = Array.from({ length: partCount }, (_, index) => index + 1).filter(
    (partNumber) => !activeSession.etags[partNumber],
  );

  let cursor = 0;
  const worker = async () => {
    for (;;) {
      if (options.signal?.aborted) return;
      const partNumber = pending[cursor++];
      if (partNumber === undefined) return;

      const start = (partNumber - 1) * MULTIPART_PART_SIZE;
      const slice = input.blob.slice(start, Math.min(start + MULTIPART_PART_SIZE, total));

      const url =
        presignedUrls?.[partNumber - 1] ??
        (await multipartUploadPart(
          client,
          { key: activeSession.key, uploadId: activeSession.uploadId, partNumber },
          options.signal,
        ));

      const { etag } = await uploadToPresignedUrl(url, slice, input.contentType, {
        signal: options.signal,
        onProgress: ({ loaded }) => {
          loadedByPart.set(partNumber, loaded);
          report();
        },
      });

      if (!etag) throw new MultipartEtagError(partNumber);

      activeSession.etags[partNumber] = etag;
      loadedByPart.set(partNumber, slice.size);
      options.onSession?.(activeSession);
      report();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_PARTS, pending.length) }, () => worker()),
  );

  const parts = Array.from({ length: partCount }, (_, index) => index + 1).map((partNumber) => ({
    partNumber,
    etag: activeSession.etags[partNumber] ?? '',
  }));

  const missing = parts.find((part) => !part.etag);
  if (missing) throw new MultipartEtagError(missing.partNumber);

  return multipartUploadComplete(
    client,
    { key: activeSession.key, uploadId: activeSession.uploadId, parts },
    options.signal,
  );
}

function sizeOfPart(partNumber: number, partCount: number, total: number): number {
  if (partNumber < partCount) return MULTIPART_PART_SIZE;
  const remainder = total % MULTIPART_PART_SIZE;
  return remainder === 0 ? MULTIPART_PART_SIZE : remainder;
}
