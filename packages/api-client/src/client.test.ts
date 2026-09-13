import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createClient } from './client';
import { ApiError, isApiError } from './errors';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientWith(fetchImpl: typeof fetch, options: Parameters<typeof createClient>[0] = {}) {
  return createClient({ fetchImpl, ...options });
}

describe('envelope unwrapping', () => {
  it('returns data from a normal success envelope', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 200, status: 'success', message: 'ok', data: { id: 'a1' } }),
    );
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    const result = await client.get('/api/scan/a1/get', {
      schema: z.object({ id: z.string() }),
    });

    expect(result).toEqual({ id: 'a1' });
  });

  it('treats a 200 with NO status field as success', async () => {
    // POST /api/scan-review/request answers `{message}` with no `status` on the
    // group-leader branch. The legacy client derived success from
    // status === 'success' and so reported a successful request as a failure.
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ message: 'Review requested' }),
    );
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    await expect(client.post('/api/scan-review/request')).resolves.toBeUndefined();
  });

  it('throws when a 200 body declares status: error', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 200, status: 'error', message: 'Nope' }),
    );
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    await expect(client.get('/api/scan/list')).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'http',
      message: 'Nope',
    });
  });

  it('resolves undefined when the envelope omits data entirely', async () => {
    // DELETE /api/shared-scans/:id sends no `data` key at all.
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 200, status: 'success', message: 'Deleted' }),
    );
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    await expect(client.del('/api/shared-scans/x')).resolves.toBeUndefined();
  });
});

describe('error handling', () => {
  it('throws an ApiError carrying statusCode, message and details', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(
        { statusCode: 400, status: 'error', message: 'Invalid Scan Status', details: 'bad enum' },
        400,
      ),
    );
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    const error = await client.get('/api/scan/list').catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({ statusCode: 400, message: 'Invalid Scan Status' });
    expect((error as ApiError).details).toBe('bad enum');
  });

  it('maps a Zod-issue details array onto field errors', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(
        {
          statusCode: 400,
          status: 'error',
          message: 'Refresh Token is required',
          details: [{ code: 'invalid_type', path: ['query', 'refreshToken'], message: 'Required' }],
        },
        400,
      ),
    );
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    const error = (await client.get('/api/me').catch((e: unknown) => e)) as ApiError;

    expect(error.fieldErrors()).toEqual({ refreshToken: 'Required' });
  });

  it('fires onUnauthorized for a 401 on an authed request', async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 401, status: 'error', message: 'Unauthorized' }, 401),
    );
    const client = clientWith(fetchImpl as unknown as typeof fetch, {
      getToken: () => 'jwt',
      onUnauthorized,
    });

    await expect(client.get('/api/scan/list')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onUnauthorized.mock.calls[0]?.[0]).toMatchObject({ path: '/api/scan/list' });
  });

  it('does not fire onUnauthorized when the request opted out of auth', async () => {
    // POST /api/switch-user is the one call that runs unauthenticated; a 401
    // there must not bounce the current session.
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 401, status: 'error', message: 'Unauthorized' }, 401),
    );
    const client = clientWith(fetchImpl as unknown as typeof fetch, { onUnauthorized });

    await expect(client.post('/api/switch-user', { requireAuth: false })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('re-throws an AbortError untouched so React Query sees a cancellation', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      throw abortError;
    });
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    await expect(client.get('/api/scan/list')).rejects.toBe(abortError);
  });

  it('wraps a transport failure as a network ApiError', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      throw new TypeError('Failed to fetch');
    });
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    await expect(client.get('/api/scan/list')).rejects.toMatchObject({ kind: 'network' });
  });

  it('throws a parse ApiError when the payload does not match the schema', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ status: 'success', data: { id: 42 } }),
    );
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    await expect(
      client.get('/api/scan/x/get', { schema: z.object({ id: z.string() }) }),
    ).rejects.toMatchObject({ kind: 'parse' });
  });
});

describe('request construction', () => {
  it('sends the bearer token and JSON content type', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ status: 'success', data: null }),
    );
    const client = clientWith(fetchImpl as unknown as typeof fetch, { getToken: () => 'jwt-123' });

    await client.post('/api/login', { body: { userEmail: 'a@b.c' } });

    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer jwt-123',
      'Content-Type': 'application/json',
    });
    expect(init.body).toBe(JSON.stringify({ userEmail: 'a@b.c' }));
  });

  it('omits Content-Type for FormData so the browser sets the boundary', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ status: 'success', data: null }),
    );
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    await client.post('/api/scan/upload', { body: new FormData() });

    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it('prefixes baseUrl and appends the encoded query', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ status: 'success', data: null }),
    );
    const client = clientWith(fetchImpl as unknown as typeof fetch, {
      baseUrl: 'http://localhost:5001',
    });

    await client.get('/api/scan/list', { query: { page: 2, tags: ['a', 'b'] } });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'http://localhost:5001/api/scan/list?page=2&tags=a%2Cb',
    );
  });
});
