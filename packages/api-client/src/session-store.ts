import { authSessionSchema, type AuthSession } from './schemas/auth';

/**
 * The ONE place a session touches storage.
 *
 * The legacy dashboard read `localStorage['token']` from the transport, wrote
 * `localStorage['token']` and `localStorage['user']` from the auth context,
 * and also exported setAuthToken/clearAuthToken/hasAuthToken helpers that
 * nothing imported. Three writers, one of them dead. Everything funnels here
 * instead, and the client only ever asks this module for the token.
 */

export const SESSION_STORAGE_KEY = 'sector.session';

export type SessionStore = {
  read(): AuthSession | null;
  write(session: AuthSession): void;
  clear(): void;
  /** Bearer token for the API client, or null when signed out. */
  getToken(): string | null;
};

/**
 * localStorage-backed, with an in-memory fallback. Every access is guarded:
 * a private window, blocked site data, or a cleared store makes localStorage
 * throw or return null, and the app must still render.
 */
export function createSessionStore(storageKey: string = SESSION_STORAGE_KEY): SessionStore {
  let memory: AuthSession | null = null;

  function storage(): Storage | null {
    try {
      return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
      return null;
    }
  }

  /**
   * The stored session, or null when there is nothing usable there.
   *
   * VALIDATED, not cast. This used to be `JSON.parse(raw) as AuthSession`
   * with a check on the token alone, which let anything carrying a token past
   * the door while the return type promised a whole AuthSession. A value with
   * a token but no `user` — a half-written entry, a truncated quota write, a
   * hand-edited key — therefore reached the auth context, where
   * `session?.user.role` guards the session but not the user and throws. The
   * result was a white screen on every load, with no way for the person at
   * the machine to reach the sign-in page and clear it.
   *
   * Parsing against the same schema the login response is parsed with keeps
   * this function's return type honest for every caller, instead of asking
   * each one to re-check the parts it touches.
   *
   * A session that fails is REMOVED rather than left to fail again on every
   * load. The trade-off is worth naming: if a future required field is added
   * to the user schema, sessions written by the previous build stop parsing
   * and everyone is signed out once on upgrade. That is the good outcome —
   * the alternative, before this change, was that they crashed instead.
   */
  function read(): AuthSession | null {
    if (memory) return memory;

    const store = storage();
    if (!store) return null;

    let raw: string | null = null;
    try {
      raw = store.getItem(storageKey);
    } catch {
      return null;
    }
    if (!raw) return null;

    let candidate: unknown;
    try {
      candidate = JSON.parse(raw);
    } catch {
      candidate = null;
    }

    const parsed = authSessionSchema.safeParse(candidate);
    // An empty token parses as a string but authenticates nothing.
    if (!parsed.success || !parsed.data.token) {
      clear();
      return null;
    }

    memory = parsed.data;
    return memory;
  }

  function write(session: AuthSession): void {
    memory = session;
    try {
      storage()?.setItem(storageKey, JSON.stringify(session));
    } catch {
      // Non-fatal: the session still works for this tab, it just will not
      // survive a reload.
    }
  }

  function clear(): void {
    memory = null;
    try {
      storage()?.removeItem(storageKey);
    } catch {
      // Nothing to do; the in-memory copy is already gone.
    }
  }

  return {
    read,
    write,
    clear,
    getToken: () => read()?.token ?? null,
  };
}
