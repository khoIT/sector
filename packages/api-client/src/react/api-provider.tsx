import { createContext, useContext, type ReactNode } from 'react';

import type { ApiClient } from '../client';

const ApiClientContext = createContext<ApiClient | null>(null);

export type ApiClientProviderProps = {
  client: ApiClient;
  children: ReactNode;
};

/**
 * Makes one ApiClient instance available to every hook in this package.
 * Create the client once at the app root (see apps/web/src/lib/api.ts) so the
 * token getter and the onUnauthorized wiring exist in exactly one place.
 */
export function ApiClientProvider({ client, children }: ApiClientProviderProps) {
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (!client) throw new Error('useApiClient must be used inside <ApiClientProvider>');
  return client;
}
