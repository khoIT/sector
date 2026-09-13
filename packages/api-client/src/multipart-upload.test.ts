import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as UploadTransferModule from './upload-transfer';

const init = vi.fn();
const part = vi.fn();
const complete = vi.fn();
const presign = vi.fn();
const transfer = vi.fn();

vi.mock('./endpoints/scan-upload', () => ({
  multipartUploadInit: (...args: unknown[]) => init(...args),
  multipartUploadPart: (...args: unknown[]) => part(...args),
  multipartUploadComplete: (...args: unknown[]) => complete(...args),
  uploadPresign: (...args: unknown[]) => presign(...args),
}));

vi.mock('./upload-transfer', async (importOriginal) => {
  const actual = await importOriginal<typeof UploadTransferModule>();
  return {
    ...actual,
    uploadToPresignedUrl: (...args: unknown[]) => transfer(...args),
  };
});

const {
  MULTIPART_PART_SIZE,
  MULTIPART_THRESHOLD,
  MultipartEtagError,
  shouldUseMultipart,
  uploadScanObject,
} = await import('./multipart-upload');
const { UploadTransferError } = await import('./upload-transfer');

/** Fast enough that the retry tests do not depend on real timers. */
const fastRetryPolicy = { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 };

const client = {} as never;

/** A Blob of `size` bytes without allocating them all as one string. */
function blobOf(size: number): Blob {
  return new Blob([new Uint8Array(size)], { type: 'video/mp4' });
}

beforeEach(() => {
  vi.resetAllMocks();
  transfer.mockImplementation((_url: string, body: Blob) => {
    void body;
    return Promise.resolve({ etag: 'etag' });
  });
});

describe('shouldUseMultipart', () => {
  it('sends small files whole and large files in parts', () => {
    expect(shouldUseMultipart(MULTIPART_THRESHOLD)).toBe(false);
    expect(shouldUseMultipart(MULTIPART_THRESHOLD + 1)).toBe(true);
  });
});

describe('uploadScanObject', () => {
  it('uses a single PUT below the threshold and never opens a multipart upload', async () => {
    presign.mockResolvedValue({ url: 'https://s3/put', key: 'storage/a/scan/b/small.mp4' });

    const result = await uploadScanObject(client, {
      scanId: 'scan1',
      key: 'small.mp4',
      blob: blobOf(1024),
      contentType: 'video/mp4',
    });

    expect(result.key).toBe('storage/a/scan/b/small.mp4');
    expect(init).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    expect(transfer).toHaveBeenCalledTimes(1);
  });

  it('splits a large file, uses the presigned URLs from init, and completes in part order', async () => {
    const size = MULTIPART_PART_SIZE * 3 + 10;
    init.mockResolvedValue({
      uploadId: 'u1',
      key: 'storage/a/scan/b/big.mp4',
      presignedUrls: ['https://s3/1', 'https://s3/2', 'https://s3/3', 'https://s3/4'],
    });
    transfer.mockImplementation(() => Promise.resolve({ etag: 'e' }));
    complete.mockResolvedValue({ key: 'storage/a/scan/b/big.mp4' });

    await uploadScanObject(client, {
      scanId: 'scan1',
      key: 'big.mp4',
      blob: blobOf(size),
      contentType: 'video/mp4',
    });

    expect(init.mock.calls[0]?.[1]).toMatchObject({ totalParts: 4 });
    // Init handed back every URL, so no per-part presign call was needed.
    expect(part).not.toHaveBeenCalled();
    expect(transfer).toHaveBeenCalledTimes(4);
    expect(complete.mock.calls[0]?.[1]).toEqual({
      key: 'storage/a/scan/b/big.mp4',
      uploadId: 'u1',
      parts: [
        { partNumber: 1, etag: 'e' },
        { partNumber: 2, etag: 'e' },
        { partNumber: 3, etag: 'e' },
        { partNumber: 4, etag: 'e' },
      ],
    });
  });

  it('presigns each part when init returns no URLs', async () => {
    init.mockResolvedValue({ uploadId: 'u1', key: 'k' });
    part.mockResolvedValue('https://s3/part');
    complete.mockResolvedValue({ key: 'k' });

    await uploadScanObject(client, {
      scanId: 'scan1',
      key: 'big.mp4',
      blob: blobOf(MULTIPART_PART_SIZE * 2 + 1),
      contentType: 'video/mp4',
    });

    expect(part).toHaveBeenCalledTimes(3);
  });

  it('resumes from a session, re-sending only the parts that never landed', async () => {
    complete.mockResolvedValue({ key: 'k' });
    part.mockResolvedValue('https://s3/part');

    await uploadScanObject(
      client,
      {
        scanId: 'scan1',
        key: 'big.mp4',
        blob: blobOf(MULTIPART_PART_SIZE * 3 + 5),
        contentType: 'video/mp4',
      },
      { session: { uploadId: 'u1', key: 'k', etags: { 1: 'a', 2: 'b' } } },
    );

    expect(init).not.toHaveBeenCalled();
    expect(transfer).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[0]?.[1]).toMatchObject({
      parts: [
        { partNumber: 1, etag: 'a' },
        { partNumber: 2, etag: 'b' },
        { partNumber: 3, etag: 'etag' },
        { partNumber: 4, etag: 'etag' },
      ],
    });
  });

  it('publishes the session as parts land, so a retry can resume', async () => {
    init.mockResolvedValue({ uploadId: 'u1', key: 'k', presignedUrls: ['a', 'b', 'c'] });
    complete.mockResolvedValue({ key: 'k' });
    const seen: Array<Record<number, string>> = [];

    await uploadScanObject(
      client,
      {
        scanId: 'scan1',
        key: 'big.mp4',
        blob: blobOf(MULTIPART_PART_SIZE * 2 + 1),
        contentType: 'video/mp4',
      },
      { onSession: (session) => seen.push({ ...session.etags }) },
    );

    expect(seen[0]).toEqual({});
    expect(seen.at(-1)).toEqual({ 1: 'etag', 2: 'etag', 3: 'etag' });
  });

  it('refuses to complete when the bucket hides ETag from the browser', async () => {
    init.mockResolvedValue({ uploadId: 'u1', key: 'k', presignedUrls: ['a', 'b', 'c'] });
    transfer.mockResolvedValue({ etag: null });

    await expect(
      uploadScanObject(client, {
        scanId: 'scan1',
        key: 'big.mp4',
        blob: blobOf(MULTIPART_PART_SIZE * 2 + 1),
        contentType: 'video/mp4',
      }),
    ).rejects.toBeInstanceOf(MultipartEtagError);
    expect(complete).not.toHaveBeenCalled();
  });

  it('reports progress that counts already-accepted parts', async () => {
    complete.mockResolvedValue({ key: 'k' });
    part.mockResolvedValue('https://s3/part');
    const percents: number[] = [];

    await uploadScanObject(
      client,
      {
        scanId: 'scan1',
        key: 'big.mp4',
        blob: blobOf(MULTIPART_PART_SIZE * 4),
        contentType: 'video/mp4',
      },
      {
        session: { uploadId: 'u1', key: 'k', etags: { 1: 'a', 2: 'b' } },
        onProgress: ({ percent }) => percents.push(percent),
      },
    );

    // Half the object was already up, so the bar starts at 50 and not at 0.
    expect(percents[0]).toBe(50);
    expect(percents.at(-1)).toBe(100);
  });

  it('retries a single-shot PUT that fails with a retryable status and still succeeds', async () => {
    presign.mockResolvedValue({ url: 'https://s3/put', key: 'storage/a/scan/b/small.mp4' });
    transfer
      .mockRejectedValueOnce(new UploadTransferError('Bad gateway', 502))
      .mockResolvedValueOnce({ etag: 'etag' });

    const result = await uploadScanObject(
      client,
      { scanId: 'scan1', key: 'small.mp4', blob: blobOf(1024), contentType: 'video/mp4' },
      { retryPolicy: fastRetryPolicy },
    );

    expect(result.key).toBe('storage/a/scan/b/small.mp4');
    expect(transfer).toHaveBeenCalledTimes(2);
  });

  it('does not retry a single-shot PUT that fails with a 4xx status', async () => {
    presign.mockResolvedValue({ url: 'https://s3/put', key: 'k' });
    const rejection = new UploadTransferError('Forbidden', 403);
    transfer.mockRejectedValue(rejection);

    await expect(
      uploadScanObject(
        client,
        { scanId: 'scan1', key: 'small.mp4', blob: blobOf(1024), contentType: 'video/mp4' },
        { retryPolicy: fastRetryPolicy },
      ),
    ).rejects.toBe(rejection);
    expect(transfer).toHaveBeenCalledTimes(1);
  });

  it('retries a failed part and completes once it lands', async () => {
    init.mockResolvedValue({ uploadId: 'u1', key: 'k', presignedUrls: ['a', 'b', 'c'] });
    complete.mockResolvedValue({ key: 'k' });
    transfer
      .mockRejectedValueOnce(new UploadTransferError('Network error', 0))
      .mockResolvedValue({ etag: 'etag' });

    await uploadScanObject(
      client,
      {
        scanId: 'scan1',
        key: 'big.mp4',
        blob: blobOf(MULTIPART_PART_SIZE * 2 + 1),
        contentType: 'video/mp4',
      },
      { retryPolicy: fastRetryPolicy },
    );

    // 3 parts, one of which needed a second attempt.
    expect(transfer).toHaveBeenCalledTimes(4);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('preserves cancellation: aborting during a retry wait stops the upload', async () => {
    presign.mockResolvedValue({ url: 'https://s3/put', key: 'k' });
    const controller = new AbortController();
    transfer.mockImplementation(() => {
      controller.abort();
      return Promise.reject(new UploadTransferError('Network error', 0));
    });

    await expect(
      uploadScanObject(
        client,
        { scanId: 'scan1', key: 'small.mp4', blob: blobOf(1024), contentType: 'video/mp4' },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(transfer).toHaveBeenCalledTimes(1);
  });
});
