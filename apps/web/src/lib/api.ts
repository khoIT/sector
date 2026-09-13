import {
  createClient,
  createSessionStore,
  type ApiClient,
  type UnauthorizedContext,
} from '@sector/api-client';

/**
 * The single ApiClient and the single SessionStore for the whole app.
 *
 * Module scope on purpose: the client must not be re-created on render, and
 * exactly one place may own the token read path.
 */

export const sessionStore = createSessionStore();

/**
 * Set by AuthProvider on mount. The transport cannot import the router or the
 * auth context without a cycle, so a 401 is handed to whoever registered here.
 */
let unauthorizedHandler: ((context: UnauthorizedContext) => void) | null = null;

export function setUnauthorizedHandler(
  handler: ((context: UnauthorizedContext) => void) | null,
): void {
  unauthorizedHandler = handler;
}

export const apiClient: ApiClient = createClient({
  // Empty in development: the Vite proxy forwards same-origin /api to :5001.
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  getToken: () => sessionStore.getToken(),
  onUnauthorized: (context) => unauthorizedHandler?.(context),
});
