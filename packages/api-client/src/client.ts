import type { ZodType, ZodTypeDef } from 'zod';

import { envelopeData, envelopeDetails, envelopeMessage, isErrorEnvelope } from './envelope';
import { ApiError, isAbortError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined | Array<string | number>;
export type QueryInput = Record<string, QueryValue>;

export type UnauthorizedContext = {
  path: string;
  error: ApiError;
};

export type CreateClientOptions = {
  /**
   * Origin to prefix every path with. Defaults to '' (same origin), which is
   * what the Vite dev proxy expects: the browser calls /api/... and Vite
   * forwards it to the legacy API on :5001. Set an absolute origin only when
   * calling the API cross-origin.
   */
  baseUrl?: string;
  /** Returns the raw JWT, or null when signed out. Read on every request. */
  getToken?: () => string | null;
  /**
   * Fired on any 401 from a request that carried auth. The transport does NOT
   * navigate or clear storage itself — a `window.location` assignment inside
   * the transport is untestable and fights the router. The app wires this to
   * its auth context.
   */
  onUnauthorized?: (context: UnauthorizedContext) => void;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

/**
 * A Zod schema used to validate a response body.
 *
 * The input parameter is pinned to `unknown` rather than left to default to
 * the output type. Any schema using `.default()` or `.transform()` has an
 * input type that differs from its output type, and `ZodType<T>` would then
 * fail to match — which is every scan schema in this package.
 */
export type ResponseSchema<TOut> = ZodType<TOut, ZodTypeDef, unknown>;

export type RequestOptions<TOut> = {
  method?: HttpMethod;
  /** Plain object (JSON-encoded) or FormData (browser sets the boundary). */
  body?: unknown;
  query?: QueryInput;
  /**
   * Zod schema for the envelope's `data`. When present the response is PARSED,
   * not cast: a shape drift fails loudly here instead of surfacing as an
   * undefined deep in a component.
   */
  schema?: ResponseSchema<TOut>;
  /** Send the bearer token. Default true. POST /api/switch-user sets false. */
  requireAuth?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /**
   * Let the request outlive the page that started it.
   *
   * For the final write on the way out of a video: React does not unmount on a
   * tab close, and a `fetch` issued from `pagehide` is cancelled with the
   * document unless it is marked this way. Browsers cap keepalive bodies at
   * 64 KB, so it suits small pings and nothing else.
   */
  keepalive?: boolean;
};

export interface ApiClient {
  readonly baseUrl: string;
  request<TOut = unknown>(path: string, options?: RequestOptions<TOut>): Promise<TOut>;
  get<TOut = unknown>(path: string, options?: Omit<RequestOptions<TOut>, 'method'>): Promise<TOut>;
  post<TOut = unknown>(path: string, options?: Omit<RequestOptions<TOut>, 'method'>): Promise<TOut>;
  put<TOut = unknown>(path: string, options?: Omit<RequestOptions<TOut>, 'method'>): Promise<TOut>;
  patch<TOut = unknown>(
    path: string,
    options?: Omit<RequestOptions<TOut>, 'method'>,
  ): Promise<TOut>;
  del<TOut = unknown>(path: string, options?: Omit<RequestOptions<TOut>, 'method'>): Promise<TOut>;
}

/**
 * Encode a query object. Arrays become comma-separated (`tags=a,b`) because
 * that is what the scan list routes parse. Empty strings, null and undefined
 * are dropped so no stray `&&` or `keyword=` ends up in the URL.
 *
 * The legacy client concatenated raw values, so a keyword containing `&` or
 * `=` corrupted the query string. URLSearchParams fixes that for free.
 */
export function encodeQuery(query: QueryInput | undefined): string {
  if (!query) return '';

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      const joined = value.filter((v) => v !== '' && v !== null && v !== undefined).join(',');
      if (joined) params.set(key, joined);
      continue;
    }

    params.set(key, String(value));
  }

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export function createClient(options: CreateClientOptions = {}): ApiClient {
  const { baseUrl = '', getToken, onUnauthorized, fetchImpl } = options;
  const doFetch: typeof fetch = fetchImpl ?? ((...args) => globalThis.fetch(...args));

  async function request<TOut = unknown>(
    path: string,
    requestOptions: RequestOptions<TOut> = {},
  ): Promise<TOut> {
    const {
      method = 'GET',
      body,
      query,
      schema,
      requireAuth = true,
      signal,
      headers = {},
      keepalive,
    } = requestOptions;

    const url = `${baseUrl}${path}${encodeQuery(query)}`;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    const finalHeaders: Record<string, string> = {};
    // FormData must set its own Content-Type so the multipart boundary survives.
    if (body !== undefined && !isFormData) finalHeaders['Content-Type'] = 'application/json';
    if (requireAuth) {
      const token = getToken?.() ?? null;
      if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
    }
    Object.assign(finalHeaders, headers);

    let response: Response;
    try {
      response = await doFetch(url, {
        method,
        headers: finalHeaders,
        signal,
        keepalive,
        body:
          body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
      });
    } catch (error) {
      // A cancelled request is not a failure. Re-throw untouched so React Query
      // records a cancellation rather than an error (the scan autosave path
      // aborts in-flight PUTs on every keystroke and depends on this).
      if (isAbortError(error)) throw error;
      throw new ApiError({
        kind: 'network',
        message: error instanceof Error ? error.message : 'Network error',
        path,
        cause: error,
      });
    }

    const text = await response.text();
    let parsedBody: unknown;
    if (text) {
      try {
        parsedBody = JSON.parse(text) as unknown;
      } catch {
        parsedBody = undefined;
      }
    }

    if (!response.ok) {
      const error = new ApiError({
        kind: 'http',
        statusCode: response.status,
        message: envelopeMessage(parsedBody) ?? response.statusText ?? 'Request failed',
        path,
        details: envelopeDetails(parsedBody),
      });
      if (response.status === 401 && requireAuth) onUnauthorized?.({ path, error });
      throw error;
    }

    // A 2xx that still declares failure. Missing `status` counts as success.
    if (isErrorEnvelope(parsedBody)) {
      throw new ApiError({
        kind: 'http',
        statusCode: response.status,
        message: envelopeMessage(parsedBody) ?? 'Request failed',
        path,
        details: envelopeDetails(parsedBody),
      });
    }

    const data = envelopeData(parsedBody);
    if (!schema) return data as TOut;

    const result = schema.safeParse(data);
    if (!result.success) {
      throw new ApiError({
        kind: 'parse',
        message: `Unexpected response shape from ${path}`,
        path,
        details: result.error.issues,
        cause: result.error,
      });
    }

    return result.data;
  }

  const withMethod =
    (method: HttpMethod) =>
    <TOut = unknown>(path: string, requestOptions: Omit<RequestOptions<TOut>, 'method'> = {}) =>
      request<TOut>(path, { ...requestOptions, method });

  return {
    baseUrl,
    request,
    get: withMethod('GET'),
    post: withMethod('POST'),
    put: withMethod('PUT'),
    patch: withMethod('PATCH'),
    del: withMethod('DELETE'),
  };
}
