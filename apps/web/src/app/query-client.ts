import { shouldRetryApiError } from '@sector/api-client';
import { QueryClient } from '@tanstack/react-query';

/**
 * One QueryClient for the app.
 *
 * `retry: shouldRetryApiError` is the important line: a 4xx will not become a
 * 2xx on retry, so retrying makes every permission denial and validation error
 * three times slower for no benefit.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryApiError,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
