import { isApiError } from '../errors';

/**
 * Default React Query retry policy for this API.
 *
 * Retrying a 4xx is pointless and slows every permission denial and validation
 * error down by three round trips. A parse failure is a code bug, not a
 * transient one, so it is not retried either. Wire it once in the app's
 * QueryClient defaultOptions.
 */
export function shouldRetryApiError(failureCount: number, error: unknown): boolean {
  if (isApiError(error)) {
    if (error.kind === 'parse') return false;
    if (error.statusCode >= 400 && error.statusCode < 500) return false;
  }
  return failureCount < 2;
}
