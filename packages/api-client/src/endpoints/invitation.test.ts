import { describe, expect, it, vi } from 'vitest';

import { createClient } from '../client';
import { isApiError } from '../errors';
import { confirmGroupInvitation } from './invitation';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('confirmGroupInvitation', () => {
  it('posts without auth and parses {userId, groupMemberId, groupId}', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        statusCode: 200,
        status: 'success',
        message: 'Group invitation confirmed successfully. Welcome to the group!',
        data: { userId: 'user-1', groupMemberId: 'member-1', groupId: 'group-1' },
      }),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await confirmGroupInvitation(client, {
      token: 'invite.jwt',
      password: 'Passphrase!2026',
    });
    expect(result).toEqual({ userId: 'user-1', groupMemberId: 'member-1', groupId: 'group-1' });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe('/api/group-members/confirm-invitation');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it.each([
    'Invalid or expired invitation link. Please request a new invitation from your group leader.',
    'This invitation has already been processed',
  ])('surfaces the server message %j for the caller to render', async (message) => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 400, status: 'error', message }, 400),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(
      confirmGroupInvitation(client, { token: 'bad', password: 'Passphrase!2026' }),
    ).rejects.toSatisfy((error: unknown) => isApiError(error) && error.message === message);
  });
});
