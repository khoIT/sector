/**
 * Reading scan media bytes in the browser, despite the CDN.
 *
 * Media URLs are CloudFront canned-policy signed URLs. The distribution serves
 * NO CORS headers — not on a plain GET, not with an `Origin`, and it answers
 * `403` to an `OPTIONS` preflight outright — so `fetch()` can never read those
 * bytes from any origin. That blocks Download, which has to hold the bytes to
 * put them in a zip.
 *
 * `<img>` and `<video>` are unaffected: a media element loads cross-origin
 * without CORS. Only code that wants to READ the bytes is blocked, so only
 * Download goes through here.
 *
 * The signature covers the query string, so the usual escape —
 * `response-content-disposition=attachment` — answers `403 AccessDenied`.
 * Verified against the staging distribution, along with the fact that these
 * are CloudFront signed URLs rather than S3 presigned ones, which is why that
 * S3-only parameter has no meaning here anyway.
 *
 * What is left is to stop being cross-origin: the dev server fetches the
 * object and hands it back same-origin. The signature survives because the
 * proxy reproduces host, path and query exactly.
 *
 * This is a DEVELOPMENT fix. A built bundle has no dev server, so
 * `mediaFetchUrl` leaves the URL alone there and Download fails honestly
 * rather than 404ing against a proxy that does not exist. Production needs a
 * CORS policy on the distribution, or a streaming route on the API.
 */

/** Where the dev server mounts the proxy. Must match vite-media-proxy.ts. */
export const MEDIA_PROXY_PATH = '/media-proxy';

/**
 * Hosts the proxy will fetch from.
 *
 * The dev server would otherwise be an open proxy on the developer's machine:
 * anything that could get a URL into this function could make their laptop
 * issue requests to `localhost`, to cloud metadata endpoints, or to an
 * internal network. Scan media only ever lives behind CloudFront or S3, so the
 * allowlist costs nothing and closes that.
 */
const ALLOWED_MEDIA_HOSTS: readonly string[] = ['.cloudfront.net', '.amazonaws.com'];

/** True when `url` is an absolute https URL on a host the proxy will fetch. */
export function isProxyableMediaUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Relative URLs are already same-origin and need no proxy.
    return false;
  }

  if (parsed.protocol !== 'https:') return false;

  const host = parsed.hostname.toLowerCase();
  return ALLOWED_MEDIA_HOSTS.some((suffix) => host.endsWith(suffix));
}

/**
 * The same object, addressed through the dev server.
 *
 * The whole upstream URL travels in one encoded query parameter rather than
 * being spliced into the path: the signature lives in the query string, and
 * re-encoding its parts is how a signature gets broken.
 *
 * A URL this cannot proxy is returned unchanged, so a caller never has to
 * branch.
 */
export function proxiedMediaUrl(url: string): string {
  if (!isProxyableMediaUrl(url)) return url;
  return `${MEDIA_PROXY_PATH}?url=${encodeURIComponent(url)}`;
}

/**
 * The URL to `fetch()` for this media file, here and now.
 *
 * Development gets the proxy. A built bundle gets the URL untouched, because
 * there is no dev server behind that path and a 404 would be a worse lie than
 * the CORS failure the UI already reports by name.
 */
export function mediaFetchUrl(url: string): string {
  // Read inside the function: `import.meta.env` is substituted at build time
  // and this module is also imported by the node-environment tests.
  const isDev = Boolean(import.meta.env?.DEV);
  return isDev ? proxiedMediaUrl(url) : url;
}
