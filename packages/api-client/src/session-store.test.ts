import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSessionStore, SESSION_STORAGE_KEY } from './session-store';
import type { AuthSession } from './schemas/auth';

/**
 * A localStorage that behaves like the browser's, including throwing on
 * demand — a private window and blocked site data both do.
 */
function stubStorage() {
  const map = new Map<string, string>();
  let throws = false;
  const storage = {
    getItem: (k: string) => {
      if (throws) throw new DOMException('blocked');
      return map.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (throws) throw new DOMException('blocked');
      map.set(k, v);
    },
    removeItem: (k: string) => {
      if (throws) throw new DOMException('blocked');
      map.delete(k);
    },
  };
  return { map, storage, block: () => (throws = true) };
}

let stub: ReturnType<typeof stubStorage>;

beforeEach(() => {
  stub = stubStorage();
  (globalThis as { window?: unknown }).window = { localStorage: stub.storage };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

const VALID: AuthSession = {
  token: 'bearer-7-day',
  refreshToken: 'refresh-30-day',
  user: {
    id: 'u1',
    email: 'learner@scanvault.test',
    userName: 'sv_learner',
    role: { id: 'r1', name: 'Learner', slug: 'learner', permissions: ['view:scan'] },
  },
};

describe('reading a stored session', () => {
  it('returns a well formed session and its token', () => {
    stub.map.set(SESSION_STORAGE_KEY, JSON.stringify(VALID));

    const store = createSessionStore();

    expect(store.read()).toEqual(VALID);
    expect(store.getToken()).toBe('bearer-7-day');
  });

  it('survives a round trip through storage, so a reload signs nobody out', () => {
    const first = createSessionStore();
    first.write(VALID);

    expect(createSessionStore().read()).toEqual(VALID);
  });

  it('refuses a session carrying a token but no user, and removes it', () => {
    // The shape that used to pass: enough to authenticate a request, not
    // enough to render. It reached the auth context and threw on user.role,
    // white-screening the app on every load with no way to reach sign-in.
    stub.map.set(SESSION_STORAGE_KEY, JSON.stringify({ token: 'bearer-7-day' }));

    const store = createSessionStore();

    expect(store.read()).toBeNull();
    expect(store.getToken()).toBeNull();
    expect(stub.map.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it('refuses a user whose role is missing, and removes it', () => {
    stub.map.set(
      SESSION_STORAGE_KEY,
      JSON.stringify({ token: 't', user: { id: 'u1', email: 'e', userName: 'n' } }),
    );

    expect(createSessionStore().read()).toBeNull();
    expect(stub.map.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it.each([
    ['unparseable text', 'not json at all'],
    ['a JSON primitive', '"just-a-string"'],
    ['null', 'null'],
    ['an empty token', JSON.stringify({ ...VALID, token: '' })],
  ])('refuses %s', (_name, raw) => {
    stub.map.set(SESSION_STORAGE_KEY, raw);

    expect(createSessionStore().read()).toBeNull();
  });

  it('defaults an absent permission list rather than handing back undefined', () => {
    const noPermissions = {
      ...VALID,
      user: { ...VALID.user, role: { id: 'r1', name: 'L', slug: 'l' } },
    };
    stub.map.set(SESSION_STORAGE_KEY, JSON.stringify(noPermissions));

    expect(createSessionStore().read()?.user.role.permissions).toEqual([]);
  });

  it('ignores fields the API adds that this client does not model', () => {
    stub.map.set(SESSION_STORAGE_KEY, JSON.stringify({ ...VALID, somethingNew: 'ignored' }));

    expect(createSessionStore().read()).toEqual(VALID);
  });

  it('reads through a storage that throws, without throwing', () => {
    stub.block();

    const store = createSessionStore();

    expect(store.read()).toBeNull();
    expect(store.getToken()).toBeNull();
    expect(() => store.clear()).not.toThrow();
  });

  it('serves the in-memory session when storage cannot be written', () => {
    const store = createSessionStore();
    stub.block();

    store.write(VALID);

    expect(store.read()).toEqual(VALID);
  });
});
