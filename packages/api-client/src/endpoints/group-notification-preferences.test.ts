import { describe, expect, it, vi } from 'vitest';

import { createClient } from '../client';
import {
  getGroupNotificationPreferences,
  updateGroupNotificationPreference,
} from './group-notification-preferences';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getGroupNotificationPreferences', () => {
  it('parses the led-groups list', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        statusCode: 200,
        status: 'success',
        message: 'Groups with notification status retrieved successfully',
        data: [
          {
            id: 'g1',
            name: 'Group One',
            slug: 'group-one',
            type: 'group',
            parent: null,
            notificationsEnabled: true,
            notificationTypes: ['scan_created'],
          },
        ],
      }),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await getGroupNotificationPreferences(client);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Group One');

    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe('/api/group-notifications');
  });
});

describe('updateGroupNotificationPreference', () => {
  it('PUTs to the group-scoped path and resolves void without parsing the response', async () => {
    // The route answers the saved preference with `user`/`group` POPULATED to
    // objects this client never renders — see the doc comment on the
    // endpoint. Parsing that shape would only add a way for an unrelated
    // drift there to fail a save that actually succeeded.
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        statusCode: 200,
        status: 'success',
        message: 'Group notification settings updated successfully',
        data: {
          id: 'pref-1',
          user: { id: 'u1', userName: 'leader', email: 'leader@example.test' },
          group: { id: 'g1', name: 'Group One', slug: 'group-one' },
          emailNotifications: true,
          notificationTypes: ['scan_created'],
          createdAt: '2025-06-18T17:52:19.232Z',
          updatedAt: '2025-06-18T17:52:19.232Z',
        },
      }),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(
      updateGroupNotificationPreference(client, 'g1', {
        enableNotification: true,
        notificationTypes: ['scan_created'],
      }),
    ).resolves.toBeUndefined();

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe('/api/group-notifications/g1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      enableNotification: true,
      notificationTypes: ['scan_created'],
    });
  });

  it('omits notificationTypes from the wire body when the caller omits it', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ statusCode: 200, status: 'success', message: 'ok', data: {} }),
    );
    const client = createClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await updateGroupNotificationPreference(client, 'g1', { enableNotification: true });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({ enableNotification: true });
    expect('notificationTypes' in body).toBe(false);
  });
});
