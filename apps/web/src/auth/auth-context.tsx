import {
  hasAnyPermission,
  hasPermission,
  isApiError,
  useLoginMutation,
  useRestoreSessionMutation,
  type AuthRole,
  type AuthSession,
  type AuthUser,
  type LoginPayload,
} from '@scanvault/api-client';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  clearDraftFiles,
  currentDraftId,
} from '@/features/create-scan/model/draft-blob-store-cleanup';
import { sessionStore, setUnauthorizedHandler } from '@/lib/api';

export type AuthStatus =
  /** Boot-time session restore is in flight. Render nothing route-dependent. */
  | 'restoring'
  | 'authenticated'
  | 'anonymous';

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  /** The signed-in role, or null. Same object as `user.role`, surfaced so a
   *  caller that only needs the role name does not have to guard `user`. */
  role: AuthRole | null;
  /** Flat permission list off the role. Empty when signed out. Server guards
   *  read the same strings, so a client check mirrors the API exactly. */
  permissions: readonly string[];
  /** Bearer JWT, or null. The API client reads this itself; you rarely need it. */
  token: string | null;
  signIn: (payload: LoginPayload) => Promise<AuthUser>;
  signOut: () => void;
  /**
   * Merge fields into the signed-in user after they change their own account.
   *
   * The session is what the header, the row gates and every permission check
   * read, so a saved name that only lives in a form's state is a name the rest
   * of the app does not know about until the next reload. Merged rather than
   * replaced: the account routes answer a slightly different user shape than
   * login does, and the fields they omit — `stripeCustomerId`, and the role's
   * permission list when it is not populated — must survive the write.
   */
  updateUser: (partial: Partial<AuthUser>) => void;
  /** True when the role holds EVERY permission listed. */
  can: (permission: string | string[]) => boolean;
  /** True when the role holds AT LEAST ONE of the permissions listed. */
  canAny: (permissions: string[]) => boolean;
};

/** No-permission constant, so `permissions` is referentially stable when out. */
const NO_PERMISSIONS: readonly string[] = Object.freeze([]);

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const loginMutation = useLoginMutation();
  const restoreMutation = useRestoreSessionMutation();

  const stored = sessionStore.read();
  const [session, setSession] = useState<AuthSession | null>(stored);
  // Only spend a boot-time restore when there is actually something to restore.
  const [status, setStatus] = useState<AuthStatus>(
    stored?.refreshToken ? 'restoring' : stored ? 'authenticated' : 'anonymous',
  );

  const clearSession = useCallback(() => {
    sessionStore.clear();
    setSession(null);
    setStatus('anonymous');
    queryClient.clear();

    // The create-scan draft keeps unfinished upload bytes in IndexedDB, which
    // outlive the session unless something goes and gets them. Leaving one
    // learner's ultrasound clips in the browser for whoever signs in next on a
    // shared teaching-room machine is not acceptable.
    const draftId = currentDraftId();
    if (draftId) void clearDraftFiles(draftId);
  }, [queryClient]);

  const applySession = useCallback((next: AuthSession) => {
    sessionStore.write(next);
    setSession(next);
    setStatus('authenticated');
  }, []);

  // Any 401 from any request drops the session. The transport cannot navigate
  // on its own, so RequireAuth handles the redirect once status flips.
  useEffect(() => {
    setUnauthorizedHandler(() => clearSession());
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const restoreRef = useRef(restoreMutation.mutateAsync);
  restoreRef.current = restoreMutation.mutateAsync;

  // Boot-time restore. GET /api/me ROTATES the refresh token, so the response
  // must be persisted or the next reload signs the user out. Run it once.
  const hasRestored = useRef(false);
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;

    const refreshToken = stored?.refreshToken;
    if (!refreshToken) return;

    restoreRef
      .current(refreshToken)
      .then((next) => applySession(next))
      .catch((error: unknown) => {
        // Only a 401 ends the session here. That is the status the route uses
        // for a deleted or deactivated account — evidence the session itself
        // is over.
        //
        // A 404 is NOT that. `GET /api/me` looks the user up BY the stored
        // refresh token, so it answers 404 "User not found" whenever that
        // token is merely stale — which happens every time the same account
        // signs in somewhere else, because login overwrites the stored token.
        // Treating 404 as a rejection would sign a user out of their laptop
        // the moment they signed in on their phone. Observed against the local
        // API while a second client was authenticating as the same account.
        const sessionRevoked = isApiError(error) && error.isUnauthorized;

        if (sessionRevoked) {
          sessionStore.clear();
          setSession(null);
          setStatus('anonymous');
          return;
        }

        // Everything else — a stale refresh token, a 5xx, the API being down —
        // must NOT sign out a user whose 7-day bearer is probably still fine.
        // Keep the stored session; if the bearer really is dead, the first
        // request's 401 routes through onUnauthorized and clears it properly.
        setStatus('authenticated');
      });
  }, [stored?.refreshToken, applySession]);

  const signIn = useCallback(
    async (payload: LoginPayload) => {
      const next = await loginMutation.mutateAsync(payload);
      applySession(next);
      return next.user;
    },
    [loginMutation, applySession],
  );

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, user: { ...current.user, ...partial } };
      // Persisted as well as held in state: the stored session is what a
      // reload reads before /api/me answers, so a name saved and then
      // refreshed would otherwise flash back to the old one.
      sessionStore.write(next);
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      role: session?.user.role ?? null,
      permissions: session?.user.role.permissions ?? NO_PERMISSIONS,
      token: session?.token ?? null,
      signIn,
      signOut: clearSession,
      updateUser,
      can: (permission) => hasPermission(session?.user, permission),
      canAny: (permissions) => hasAnyPermission(session?.user, permissions),
    }),
    [status, session, signIn, clearSession, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
