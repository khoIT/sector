import { describe, expect, it, vi } from 'vitest';

import {
  backoffDelayMs,
  DEFAULT_UPLOAD_RETRY_POLICY,
  isRetryableUploadStatus,
  runWithUploadRetry,
  type UploadRetryPolicy,
} from './upload-retry-policy';

const fastPolicy: UploadRetryPolicy = { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 };

describe('isRetryableUploadStatus', () => {
  it('retries a network failure (status 0)', () => {
    expect(isRetryableUploadStatus(0)).toBe(true);
  });

  it('retries 429 and every 5xx', () => {
    expect(isRetryableUploadStatus(429)).toBe(true);
    expect(isRetryableUploadStatus(500)).toBe(true);
    expect(isRetryableUploadStatus(503)).toBe(true);
    expect(isRetryableUploadStatus(599)).toBe(true);
  });

  it('never retries a 4xx other than 429', () => {
    expect(isRetryableUploadStatus(400)).toBe(false);
    expect(isRetryableUploadStatus(403)).toBe(false);
    expect(isRetryableUploadStatus(404)).toBe(false);
  });

  it('never retries a 3xx or 2xx', () => {
    expect(isRetryableUploadStatus(200)).toBe(false);
    expect(isRetryableUploadStatus(301)).toBe(false);
  });
});

describe('backoffDelayMs', () => {
  it('grows exponentially with the attempt number, before jitter', () => {
    // random() pinned to 1 removes the jitter so the exponential curve itself
    // is what is under test.
    const random = () => 1;
    expect(backoffDelayMs(1, DEFAULT_UPLOAD_RETRY_POLICY, random)).toBe(500);
    expect(backoffDelayMs(2, DEFAULT_UPLOAD_RETRY_POLICY, random)).toBe(1000);
    expect(backoffDelayMs(3, DEFAULT_UPLOAD_RETRY_POLICY, random)).toBe(2000);
  });

  it('caps at maxDelayMs however high the attempt number climbs', () => {
    expect(backoffDelayMs(10, DEFAULT_UPLOAD_RETRY_POLICY, () => 1)).toBe(
      DEFAULT_UPLOAD_RETRY_POLICY.maxDelayMs,
    );
  });

  it('applies full jitter: 0 at the low end, the cap at the high end', () => {
    expect(backoffDelayMs(1, DEFAULT_UPLOAD_RETRY_POLICY, () => 0)).toBe(0);
    expect(backoffDelayMs(1, DEFAULT_UPLOAD_RETRY_POLICY, () => 0.5)).toBe(250);
  });
});

describe('runWithUploadRetry', () => {
  it('returns the first successful attempt without retrying', async () => {
    const attempt = vi.fn().mockResolvedValue('ok');
    const result = await runWithUploadRetry(attempt, {
      policy: fastPolicy,
      isRetryable: () => true,
    });
    expect(result).toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('retries a retryable failure and succeeds within the attempt budget', async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce('ok');

    const result = await runWithUploadRetry(attempt, {
      policy: fastPolicy,
      isRetryable: () => true,
    });

    expect(result).toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxAttempts and throws the last error', async () => {
    const failure = new Error('still failing');
    const attempt = vi.fn().mockRejectedValue(failure);

    await expect(
      runWithUploadRetry(attempt, { policy: fastPolicy, isRetryable: () => true }),
    ).rejects.toBe(failure);
    expect(attempt).toHaveBeenCalledTimes(fastPolicy.maxAttempts);
  });

  it('never retries a non-retryable failure (a 4xx), failing on the first attempt', async () => {
    const failure = new Error('bad request');
    const attempt = vi.fn().mockRejectedValue(failure);

    await expect(
      runWithUploadRetry(attempt, { policy: fastPolicy, isRetryable: () => false }),
    ).rejects.toBe(failure);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('never retries a cancellation, even when isRetryable would allow it', async () => {
    const abort = new DOMException('The upload was aborted.', 'AbortError');
    const attempt = vi.fn().mockRejectedValue(abort);

    await expect(
      runWithUploadRetry(attempt, { policy: fastPolicy, isRetryable: () => true }),
    ).rejects.toBe(abort);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('rejects immediately when the signal aborts during the backoff wait', async () => {
    const controller = new AbortController();
    const attempt = vi.fn().mockImplementation(() => {
      if (attempt.mock.calls.length === 1) {
        // Abort happens the instant the first attempt fails, i.e. during the
        // wait before attempt two — this must not be swallowed by the retry.
        controller.abort();
        return Promise.reject(new Error('network blip'));
      }
      return Promise.resolve('should not get here');
    });

    await expect(
      runWithUploadRetry(attempt, {
        policy: DEFAULT_UPLOAD_RETRY_POLICY,
        isRetryable: () => true,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
