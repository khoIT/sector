import type { ApiClient, RequestOptions } from '@sector/api-client';

/**
 * A minimal in-memory `ApiClient` for adapter tests — no fetch, no server.
 * One request logged, one canned response returned, parsed through the same
 * schema the real client would apply, so a fixture that does not actually
 * match the wire schema fails the test exactly the way a real drift would.
 */
export type FakeApiRequest = { method: string; path: string; body?: unknown };
export type FakeApiHandler = (request: FakeApiRequest) => unknown;

export type FakeApiClient = ApiClient & { requests: FakeApiRequest[] };

export function createFakeApiClient(handler: FakeApiHandler): FakeApiClient {
  const requests: FakeApiRequest[] = [];

  async function request<TOut>(path: string, options: RequestOptions<TOut> = {}): Promise<TOut> {
    const method = options.method ?? 'GET';
    requests.push({ method, path, body: options.body });

    const raw = handler({ method, path, body: options.body });
    if (!options.schema) return raw as TOut;

    const parsed = options.schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `fake client: ${method} ${path} response failed its schema: ${JSON.stringify(parsed.error.issues)}`,
      );
    }
    return parsed.data;
  }

  return {
    baseUrl: '',
    requests,
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, options) => request(path, { ...options, method: 'POST' }),
    put: (path, options) => request(path, { ...options, method: 'PUT' }),
    patch: (path, options) => request(path, { ...options, method: 'PATCH' }),
    del: (path, options) => request(path, { ...options, method: 'DELETE' }),
  };
}
