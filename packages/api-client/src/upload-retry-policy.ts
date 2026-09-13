/**
 * Retry policy for the presigned-URL PUT and each multipart part.
 *
 * A single transient failure — a dropped connection, a load balancer's 502 —
 * used to fail the whole file: a 400MB clip that hiccuped at 95% cost the
 * entire re-upload. Only failures a retry can plausibly fix are retried: a
 * network error (no response reached the browser) and the status codes that
 * mean "the server wants you to try again" (429, 5xx). A 4xx status means the
 * request itself was wrong — an expired presigned URL, a malformed part
 * number — and retrying it verbatim would fail the same way three times
 * slower instead of surfacing the real problem.
 */

export type UploadRetryPolicy = {
  /** Total attempts, including the first. 3 = up to 2 retries. */
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export const DEFAULT_UPLOAD_RETRY_POLICY: UploadRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 4000,
};

/**
 * Whether an HTTP status is worth retrying.
 *
 * `0` is this package's convention (see `UploadTransferError`) for "no HTTP
 * response reached the browser" — a dropped connection or a timeout — which is
 * exactly the transient case a retry exists for.
 */
export function isRetryableUploadStatus(status: number): boolean {
  if (status === 0) return true;
  if (status === 429) return true;
  return status >= 500 && status < 600;
}

/**
 * Exponential backoff with full jitter, capped at `maxDelayMs`.
 *
 * Full jitter (a random delay somewhere between 0 and the exponential value,
 * rather than the exponential value itself) is what stops every file that
 * failed at the same moment — a whole study's worth of parts, hitting the same
 * flaky link — from retrying in the same synchronized burst.
 */
export function backoffDelayMs(
  attempt: number,
  policy: UploadRetryPolicy = DEFAULT_UPLOAD_RETRY_POLICY,
  random: () => number = Math.random,
): number {
  const exponential = policy.baseDelayMs * 2 ** (attempt - 1);
  return Math.round(random() * Math.min(exponential, policy.maxDelayMs));
}

function isAbortLike(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Resolves after `ms`, or rejects immediately (or right away) on abort. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The upload was aborted.', 'AbortError'));
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('The upload was aborted.', 'AbortError'));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export type RunWithUploadRetryOptions = {
  policy?: UploadRetryPolicy;
  /** Whether the error just thrown is worth another attempt. */
  isRetryable: (error: unknown) => boolean;
  signal?: AbortSignal;
};

/**
 * Run `attempt` up to `policy.maxAttempts` times, backing off between
 * failures `isRetryable` accepts.
 *
 * A cancellation is never retried and never made to wait out a backoff: it
 * rejects immediately, whether it happened during the attempt itself or during
 * the wait between attempts, so "Cancel" stays instant no matter where in the
 * retry loop it lands.
 */
export async function runWithUploadRetry<T>(
  attempt: (attemptNumber: number) => Promise<T>,
  options: RunWithUploadRetryOptions,
): Promise<T> {
  const policy = options.policy ?? DEFAULT_UPLOAD_RETRY_POLICY;
  let lastError: unknown;

  for (let attemptNumber = 1; attemptNumber <= policy.maxAttempts; attemptNumber += 1) {
    try {
      return await attempt(attemptNumber);
    } catch (error) {
      lastError = error;
      if (isAbortLike(error)) throw error;
      if (attemptNumber === policy.maxAttempts || !options.isRetryable(error)) throw error;
      await wait(backoffDelayMs(attemptNumber, policy), options.signal);
    }
  }

  // Unreachable: the loop above always returns or throws. Kept so the
  // function's return type does not need a non-null assertion at the call
  // site.
  throw lastError;
}
