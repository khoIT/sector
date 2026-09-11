import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getCurrentUser, login } from '../endpoints/auth';
import { mutationKeys } from '../query-keys';
import type { AuthSession, LoginPayload } from '../schemas/auth';
import { useApiClient } from './api-provider';

/**
 * POST /api/login.
 *
 * Clears the whole query cache on settle so a second sign-in on the same tab
 * cannot serve the previous user's scans out of cache. This fires on failure
 * too, which is deliberate: a failed login attempt following a session
 * expiry should also leave nothing behind.
 */
export function useLoginMutation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<AuthSession, Error, LoginPayload>({
    mutationKey: mutationKeys.login(),
    mutationFn: (payload) => login(client, payload),
    onSettled: () => {
      queryClient.clear();
    },
  });
}

/**
 * Session restore against GET /api/me?refreshToken=...
 *
 * Exposed as a mutation rather than a query because it is a one-shot command
 * with a side effect: the server ROTATES the refresh token, so running it
 * twice with the same input fails the second time. Caching it would be wrong.
 */
export function useRestoreSessionMutation() {
  const client = useApiClient();

  return useMutation<AuthSession, Error, string>({
    mutationFn: (refreshToken) => getCurrentUser(client, refreshToken),
  });
}
