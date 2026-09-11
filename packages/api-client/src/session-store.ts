import type { AuthSession } from './schemas/auth';

/**
 * The ONE place a session touches storage.
 *
 * The legacy dashboard read `localStorage['token']` from the transport, wrote
 * `localStorage['token']` and `localStorage['user']` from the auth context,
 * and also exported setAuthToken/clearAuthToken/hasAuthToken helpers that
 * nothing imported. Three writers, one of them dead. Everything funnels here
 * instead, and the client only ever asks this module for the token.
 */

export const SESSION_STORAGE_KEY = 'scanvault.session';

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

  function read(): AuthSession | null {
    if (memory) return memory;

    const store = storage();
    if (!store) return null;

    try {
      const raw = store.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AuthSession;
      // Anything without a token is unusable; treat it as signed out.
      if (!parsed || typeof parsed.token !== 'string' || !parsed.token) return null;
      memory = parsed;
      return parsed;
    } catch {
      return null;
    }
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
