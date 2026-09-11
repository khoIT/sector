/**
 * The `?from=` round trip between RequireAuth and the login page.
 *
 * RequireAuth stashes the URL a signed-out user asked for so the login page can
 * put them back on it. That value reaches us through the query string, which
 * means it is attacker-controllable: `?from=https://evil.example` or the
 * protocol-relative `?from=//evil.example` would turn the post-login
 * `navigate()` into an open redirect. Only in-app paths survive this filter.
 */

/** Where a signed-in user goes when there is nothing to return to. */
export const DEFAULT_SIGNED_IN_PATH = '/';

/** The search param RequireAuth writes and the login page reads. */
export const RETURN_TO_PARAM = 'from';

/**
 * Narrow an untrusted `from` value to a same-origin path, or fall back.
 *
 * Rejected: absolute URLs, protocol-relative `//host`, and the backslash
 * variant `/\host` — browsers normalise `\` to `/` in a URL, so `/\evil.example`
 * is protocol-relative too and a naive `startsWith('/')` check lets it through.
 */
export function safeRedirect(
  from: string | null | undefined,
  fallback: string = DEFAULT_SIGNED_IN_PATH,
): string {
  if (!from) return fallback;
  if (!from.startsWith('/')) return fallback;
  if (from.startsWith('//') || from.startsWith('/\\')) return fallback;
  return from;
}

/** Build the login URL that carries the attempted location back. */
export function loginPathFor(location: { pathname: string; search: string }): string {
  const from = `${location.pathname}${location.search}`;
  if (!from || from === DEFAULT_SIGNED_IN_PATH) return '/login';
  return `/login?${RETURN_TO_PARAM}=${encodeURIComponent(from)}`;
}

/** Read and sanitise the return path out of a location's search string. */
export function returnPathFrom(search: string): string {
  return safeRedirect(new URLSearchParams(search).get(RETURN_TO_PARAM));
}
