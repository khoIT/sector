import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getAssignmentsForGroup } from './group-assignment';

/** Records the path and query a call would make, and answers an empty page. */
function recordingClient() {
  const calls: Array<{ path: string; query?: Record<string, unknown> }> = [];
  const client = {
    get: async (path: string, options?: { query?: Record<string, unknown> }) => {
      calls.push({ path, query: options?.query });
      return { page: 0, totalPages: 0, totalItems: 0, limit: 20, items: [] };
    },
  };
  return { calls, client: client as never };
}

describe('getAssignmentsForGroup', () => {
  /**
   * The regression: this client used to have a second reader of the same
   * domain, pointed at `GET /api/group-assignment?groupId=`. That route applies
   * `read:group-assignment` — which `subscriber` holds — and then trusts the
   * `groupId` the caller sends, so it answers for any group, and for all of
   * them when the parameter is omitted. Only the group-scoped route checks the
   * caller is an active member.
   */
  it('reads a group through the path-scoped route, not the list route', async () => {
    const { calls, client } = recordingClient();

    await getAssignmentsForGroup(client, '6a6ae3d759ab84398c7cee4f');

    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe('/api/group-assignment/group/6a6ae3d759ab84398c7cee4f');
    expect(calls[0].query).not.toHaveProperty('groupId');
  });

  it('does not filter the list to one assignment type', async () => {
    const { calls, client } = recordingClient();

    await getAssignmentsForGroup(client, 'g1', { page: 2, limit: 50 });

    expect(calls[0].query).toMatchObject({ page: '2', limit: '50' });
    expect(calls[0].query).not.toHaveProperty('assignmentType');
  });
});

describe('the group-assignment list route', () => {
  it('is not called from anywhere in this client', async () => {
    const root = join(import.meta.dirname, '..');
    const sources: string[] = [];

    async function walk(dir: string): Promise<void> {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) sources.push(full);
      }
    }
    await walk(root);

    // The scoped route is `/api/group-assignment/group/:id` and the lookups are
    // `/api/group-assignment/learners` and `/group-courses`. A GET of the bare
    // `/api/group-assignment` is the unscoped list; a POST to it is the create
    // route, which is a different concern and stays.
    const offenders = sources.filter((file) =>
      /\.get\(\s*['"`]\/api\/group-assignment['"`]/.test(readFileSync(file, 'utf8')),
    );

    expect(offenders).toEqual([]);
  });
});
