/**
 * One error convention for the whole client: every failure throws an ApiError.
 *
 * The legacy dashboard had two conventions living side by side — read calls
 * threw `new Error(message)`, while upload/create/tag/export calls resolved
 * with `{success:false}` and made every caller remember to check. That split
 * was the single largest source of caller confusion, so it is gone.
 */

export type ApiErrorKind =
  /** The server answered with a non-2xx status, or a 2xx body marked status:'error'. */
  | 'http'
  /** The transport failed before a response arrived (offline, DNS, CORS). */
  | 'network'
  /** A 2xx body arrived but did not match the Zod schema for that endpoint. */
  | 'parse';

export type ApiErrorInit = {
  kind: ApiErrorKind;
  message: string;
  /** HTTP status. 0 for `network` and `parse` failures. */
  statusCode?: number;
  /** Request path, for logging and for the onUnauthorized callback. */
  path?: string;
  /**
   * Server-supplied error payload. The legacy API is inconsistent here: it can
   * be a plain string ("Invalid token"), a record of field -> message, or an
   * array of Zod issues. Use `fieldErrors()` instead of reading it directly.
   */
  details?: unknown;
  cause?: unknown;
};

type ZodIssueLike = { path?: Array<string | number>; message?: string };

function isZodIssueLike(value: unknown): value is ZodIssueLike {
  return typeof value === 'object' && value !== null && 'message' in value;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly statusCode: number;
  readonly path: string;
  readonly details: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = 'ApiError';
    this.kind = init.kind;
    this.statusCode = init.statusCode ?? 0;
    this.path = init.path ?? '';
    this.details = init.details;
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  /**
   * Normalise `details` into `{ fieldName: message }` for react-hook-form
   * setError(). Returns {} when the server sent something unmappable.
   *
   * Handles the two shapes the API actually emits:
   *   - Zod issue array: [{ path: ['query','refreshToken'], message: '...' }]
   *     -> keyed by the LAST path segment, which is the field name.
   *   - Record: { password: 'Too short' }
   */
  fieldErrors(): Record<string, string> {
    const { details } = this;
    const out: Record<string, string> = {};

    if (Array.isArray(details)) {
      for (const issue of details) {
        if (!isZodIssueLike(issue) || !issue.message) continue;
        const segments = issue.path ?? [];
        const field = segments.length ? String(segments[segments.length - 1]) : '_';
        out[field] = issue.message;
      }
      return out;
    }

    if (typeof details === 'object' && details !== null) {
      for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
        if (typeof value === 'string') out[key] = value;
      }
    }

    return out;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * True for a request the caller cancelled (AbortController). React Query
 * treats these as cancellations rather than failures, so the transport
 * re-throws them untouched instead of wrapping them in an ApiError.
 */
export function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}
