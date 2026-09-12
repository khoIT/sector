import { describe, expect, it, vi } from 'vitest';

import { createClient } from './client';
import { deleteScan } from './endpoints/scan-delete';
import { isApiError } from './errors';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('deleteScan', () => {
  it('calls DELETE on the scan-scoped delete path', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        statusCode: 200,
        status: 'success',
        message: 'Scan deleted successfully',
        data: { _id: 'scan-1' },
      }),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(deleteScan(client, 'scan-1')).resolves.toBeUndefined();

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/api/scan/scan-1/delete');
    expect(init.method).toBe('DELETE');
  });

  it('sends no body — the route takes the id from the path', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 200, status: 'success', message: 'ok', data: {} }),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await deleteScan(client, 'scan-1');

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it('surfaces a 403 as an ApiError rather than resolving', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 403, status: 'error', message: 'Forbidden' }, 403),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(deleteScan(client, 'scan-1')).rejects.toSatisfy(isApiError);
  });

  it('surfaces a 404 for a scan that is already gone', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 404, status: 'error', message: 'Scan item not found' }, 404),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(deleteScan(client, 'missing')).rejects.toThrow('Scan item not found');
  });

  it('passes the abort signal through', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 200, status: 'success', message: 'ok', data: {} }),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await deleteScan(client, 'scan-1', controller.signal);

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });
});
