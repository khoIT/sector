import { describe, expect, it, vi } from 'vitest';

import { createClient } from '../client';
import { isApiError } from '../errors';
import { deleteAccount } from './account-delete';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('deleteAccount', () => {
  it('sends DELETE with the confirmation email as the body and resolves void', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 200, status: 'success', message: 'Account deleted successfully' }),
    );
    const client = createClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      getToken: () => 'bearer-token',
    });

    await expect(deleteAccount(client, { email: 'learner@example.test' })).resolves.toBeUndefined();

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe('/api/account/delete');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'learner@example.test' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer bearer-token');
  });

  it('surfaces "Email not matched" from the server rather than a generic failure', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 400, status: 'error', message: 'Email not matched' }, 400),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(deleteAccount(client, { email: 'wrong@example.test' })).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.message === 'Email not matched',
    );
  });
});
