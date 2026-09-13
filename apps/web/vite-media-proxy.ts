import { Readable } from 'node:stream';

import type { Plugin } from 'vite';

import { MEDIA_PROXY_PATH, isProxyableMediaUrl } from './src/lib/media-proxy-url';

/**
 * A same-origin route to scan media, for development.
 *
 * The media CDN serves no CORS headers, so the browser refuses to let
 * `fetch()` read bytes it will happily render in a `<video>`. Download needs
 * the bytes — it zips them — so it needs a same-origin route to them.
 *
 * Not a `server.proxy` entry, because that requires one fixed target host and
 * the CDN host arrives at runtime inside the URLs the API signs. This reads
 * the upstream URL from a query parameter instead, which also keeps the
 * signature intact: host, path and query are reproduced exactly as given.
 *
 * The response is STREAMED. A study is routinely hundreds of megabytes, and
 * buffering one whole would put it in the dev server's heap.
 *
 * `isProxyableMediaUrl` is the guard that stops this being an open proxy on
 * the developer's machine; see the allowlist it enforces.
 */

/** Sent upstream, so range requests and conditional gets still work. */
const FORWARDED_REQUEST_HEADERS = ['range', 'if-none-match', 'if-modified-since'] as const;

/** Returned to the browser. Everything else the CDN says is the CDN's business. */
const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
  'cache-control',
] as const;

export function mediaProxyPlugin(): Plugin {
  return {
    name: 'sector-media-proxy',
    // Development only. A built bundle has no server here, which is why
    // `mediaFetchUrl` stops rewriting outside dev.
    apply: 'serve',

    configureServer(server) {
      server.middlewares.use(MEDIA_PROXY_PATH, (request, response) => {
        void (async () => {
          const target = new URL(request.url ?? '/', 'http://localhost').searchParams.get('url');

          if (!target || !isProxyableMediaUrl(target)) {
            response.statusCode = 400;
            response.end('Not a media URL this proxy will fetch.');
            return;
          }

          const headers = new Headers();
          for (const name of FORWARDED_REQUEST_HEADERS) {
            const value = request.headers[name];
            if (typeof value === 'string') headers.set(name, value);
          }

          try {
            const upstream = await fetch(target, { headers });

            response.statusCode = upstream.status;
            for (const name of FORWARDED_RESPONSE_HEADERS) {
              const value = upstream.headers.get(name);
              if (value) response.setHeader(name, value);
            }

            if (!upstream.body) {
              response.end();
              return;
            }

            Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(
              response,
            );
          } catch (error) {
            // The CDN being unreachable is not the dev server crashing.
            response.statusCode = 502;
            response.end(error instanceof Error ? error.message : 'Media fetch failed.');
          }
        })();
      });
    },
  };
}
