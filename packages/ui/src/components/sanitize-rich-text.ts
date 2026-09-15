import createDOMPurify, { type WindowLike } from 'dompurify';

/**
 * The sanitising policy for every lesson, topic and question body migrated
 * from WordPress into GUSI's content collections.
 *
 * The legacy dashboard rendered this content through 677 lines of render-time
 * repair (`display-html.tsx`) that patched shortcode remnants, WP block
 * comments and broken markup on every render. That is not a rendering
 * problem, it is a sanitising-policy problem: fix the allow-list once, here,
 * rather than the symptom on every paint. A WordPress shortcode like
 * `[LDAdvQuiz 47]` is inert text once it survives sanitising — it was never a
 * tag, so DOMPurify leaves it alone, and it shows up on screen as the literal
 * bracketed text an author would recognise, not as something dangerous.
 *
 * Real bodies pulled from the production mirror (v2lessons, v2topics and
 * v2questions content/answers) carry `<script>` tags pulling the Vimeo player,
 * `<iframe>` embeds, inline `onclick`/`style` attributes left by Word/WP paste,
 * nested `<table>` layouts, and answers whose entire `title` IS an `<iframe>`.
 * The fixtures in ./fixtures/rich-text-samples.ts are copied from exactly
 * those documents (with anything personally identifying stripped) and
 * sanitize-rich-text.test.ts asserts what a real body loses and keeps.
 *
 * Decisions this policy makes, spelled out because each one removes something
 * a lazier policy would keep:
 *   - No `class` and no `style` attribute, on ANY element. The design tokens
 *     style this content (typography, spacing, colour), not the CMS author —
 *     an inline `style="font-size:12pt"` from a decade of copy-pasted Word
 *     content would fight the token scale on every paragraph, and a
 *     `<div style="position:absolute">` is exactly the kind of phishing
 *     overlay a sanitiser exists to stop.
 *   - `<script>`, `<style>`, `<object>` and `<embed>` are removed entirely,
 *     contents and all.
 *   - `<iframe>` is allowed ONLY from a measured host allow-list
 *     (ALLOWED_EMBED_HOSTS below) over https. 94 of 781 published
 *     question-bank questions embed a clip and ask the learner about it
 *     ("what pathology is seen here?") — stripping the iframe blindly, as an
 *     earlier version of this policy did, leaves the stem with no image to
 *     answer from while the server still grades the question. Every iframe
 *     host actually used by learner content in the mirror was measured
 *     (`player.vimeo.com` 1,266, `esono.online` 620, `www.youtube.com` 7);
 *     `www.youtube-nocookie.com` is allowed alongside youtube.com for the
 *     privacy-enhanced embed URL YouTube itself recommends. Any other host is
 *     removed, element and all — this is an allow-list, not a filter. A
 *     surviving iframe keeps only `src`, `title`, `width`, `height` and
 *     `allowfullscreen`; every other attribute is stripped, and `sandbox`
 *     is forced to `allow-scripts allow-same-origin allow-presentation`.
 *     That pair — scripts AND same-origin together, which normally
 *     reconstitutes the very capability a sandbox exists to remove — is
 *     defensible ONLY because every host on the allow-list is a distinct
 *     origin from this app: `allow-same-origin` grants the embedded document
 *     ITS OWN origin (vimeo's, esono's, YouTube's), never GUSI's, so nothing
 *     the embedded page does — no matter how it uses `allow-scripts` — can
 *     read GUSI's cookies, storage or DOM. If this app ever embedded content
 *     from its OWN origin under this sandbox, the pair would be unsafe.
 *   - `<video>`, `<source>` and `<track>` are allowed for the 125 published
 *     bodies that embed native video rather than an iframe player. `src` (on
 *     `<video>` and `<source>`) must be `https://`; an invalid `<source>` or
 *     `<track>` is removed entirely, an invalid `<video src>` just loses the
 *     attribute (its `<source>` children may still be valid). No `autoplay`
 *     — a video plays on the learner's action via `controls`, never on its
 *     own.
 *   - Images only render from an `https://` `src`. A `data:`, `http://` or
 *     protocol-relative image is dropped (the whole element, not just the
 *     attribute — a broken-image icon is worse than no image).
 *   - A link whose `href` is an absolute `http(s)://` URL is forced to
 *     `target="_blank" rel="noopener noreferrer"`, because it is leaving
 *     GUSI. A relative link (the nested-table fixture links back into
 *     `/dashboard/...`) is left alone — it is internal navigation, not an
 *     external hop, and does not need a new tab.
 *   - EXCEPT a link back to this product's own former hostname, which is
 *     rewritten to a relative path first and then treated as internal.
 *     Authored bodies carry 1,060 such links (measured across every
 *     non-deleted lesson, topic and question body), and every one of them is
 *     `scanhub.upscan.com/dashboard/...` — a page this app serves. Left
 *     absolute they are "external", so they open a new tab on a host that is
 *     being retired and the router never sees the click; rewritten, they
 *     resolve through `app/legacy-route-map.ts` like any other legacy URL.
 *     The match is on the WHOLE hostname against a one-entry allow-list, so
 *     `scanhub.upscan.com.evil.test` is not this host and does not qualify.
 *   - `javascript:` (and every other unsafe) URL scheme never reaches an
 *     attribute in the first place: DOMPurify's own default
 *     `ALLOWED_URI_REGEXP` only accepts a fixed set of safe schemes for
 *     `href`/`src`, and this policy does not relax it.
 */

const ALLOWED_TAGS = [
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'blockquote',
  'code',
  'pre',
  'span',
  'div',
  'hr',
  'sub',
  'sup',
  'iframe',
  'video',
  'source',
  'track',
] as const;

const ALLOWED_ATTR = [
  'href',
  'src',
  'alt',
  'title',
  'colspan',
  'rowspan',
  'allowfullscreen',
  'width',
  'height',
  'controls',
  'poster',
  'playsinline',
  'preload',
  'type',
  'kind',
  'srclang',
  'label',
  'default',
] as const;

const FORBID_TAGS = ['script', 'style', 'object', 'embed'] as const;

/** Measured against the mirror: every host learner content actually embeds
 *  an iframe from, plus YouTube's privacy-enhanced domain. */
const ALLOWED_EMBED_HOSTS = new Set([
  'player.vimeo.com',
  'esono.online',
  'www.youtube.com',
  'www.youtube-nocookie.com',
]);

/**
 * This product's own former hostname. A link to it is internal navigation
 * wearing an absolute URL, not an external hop.
 *
 * One entry, matched on the entire hostname. Every absolute link to it in the
 * content is under `/dashboard/`, which `app/legacy-route-map.ts` already
 * routes; a path outside that prefix would land on this app's own
 * "page not found", which is still this product rather than a dead host.
 */
const LEGACY_APP_HOSTS = new Set(['scanhub.upscan.com']);

/**
 * The relative path for a link back to this app, or null if the href points
 * anywhere else. Query and fragment are preserved — a legacy deep link can
 * carry both.
 */
function internalPathFor(href: string): string | null {
  const value = href.trim();
  if (!isExternalHref(value)) return null;
  try {
    const url = new URL(value);
    if (!LEGACY_APP_HOSTS.has(url.hostname.toLowerCase())) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** `https://…` only. Relative, `http://`, `data:` and protocol-relative all fail. */
function isHttpsUrl(value: string): boolean {
  return /^https:\/\//i.test(value.trim());
}

/** An absolute `http(s)://` URL leaves the app; a relative path stays inside it. */
function isExternalHref(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** The hostname of an absolute URL, or null for anything `new URL()` rejects
 *  (relative paths included — an embed source is never relative). */
function hostnameOf(value: string): string | null {
  try {
    return new URL(value.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** https, AND on the measured embed host allow-list. */
function isAllowedEmbedSrc(value: string): boolean {
  if (!isHttpsUrl(value)) return false;
  const host = hostnameOf(value);
  return host !== null && ALLOWED_EMBED_HOSTS.has(host);
}

/**
 * A DOMPurify instance is bound to one `window`. The real app has exactly one
 * (the browser's); tests hand in a JSDOM window instead so this module never
 * has to touch the DOM testing stack. Cached per window so the app is not
 * rebuilding a DOMPurify instance (and re-registering its hook) on every call.
 */
const instances = new WeakMap<WindowLike, ReturnType<typeof createDOMPurify>>();

function purifyFor(window: WindowLike): ReturnType<typeof createDOMPurify> {
  const cached = instances.get(window);
  if (cached) return cached;

  const purify = createDOMPurify(window);

  // afterSanitizeAttributes runs once DOMPurify's own attribute scrubbing has
  // already applied the ALLOWED_ATTR allow-list to this node, so this hook
  // only ever tightens the result further — it can never re-introduce
  // anything the allow-list already removed.
  purify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src');
      if (!src || !isHttpsUrl(src)) node.remove();
      return;
    }

    if (node.tagName === 'A') {
      const href = node.getAttribute('href');
      // An absolute link back to this app becomes relative BEFORE the
      // external test below, so it keeps the router instead of a new tab.
      const internalPath = href ? internalPathFor(href) : null;
      if (internalPath) {
        node.setAttribute('href', internalPath);
        node.removeAttribute('target');
        node.removeAttribute('rel');
        return;
      }
      if (href && isExternalHref(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      } else {
        node.removeAttribute('target');
        node.removeAttribute('rel');
      }
      return;
    }

    if (node.tagName === 'IFRAME') {
      const src = node.getAttribute('src');
      if (!src || !isAllowedEmbedSrc(src)) {
        node.remove();
        return;
      }
      // See the module doc comment: allow-scripts + allow-same-origin is
      // defensible ONLY because every ALLOWED_EMBED_HOSTS entry is a distinct
      // origin from this app.
      node.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
      return;
    }

    // <source> and <track> carry nothing worth keeping without a valid src,
    // so an invalid one removes the whole element rather than leaving an
    // inert tag behind — the same call made for <img>.
    if (node.tagName === 'SOURCE' || node.tagName === 'TRACK') {
      const src = node.getAttribute('src');
      if (!src || !isHttpsUrl(src)) node.remove();
      return;
    }

    // <video> may carry its own `src`, or rely entirely on `<source>`
    // children — an insecure `src` here just loses the attribute rather than
    // taking the whole element (and its still-valid `<source>`s) down with it.
    if (node.tagName === 'VIDEO') {
      const src = node.getAttribute('src');
      if (src && !isHttpsUrl(src)) node.removeAttribute('src');
      const poster = node.getAttribute('poster');
      if (poster && !isHttpsUrl(poster)) node.removeAttribute('poster');
    }
  });

  instances.set(window, purify);
  return purify;
}

/**
 * Sanitise one HTML body under this policy.
 *
 * `window` defaults to the real browser global so call sites in the app never
 * pass one; the sanitiser test is the only caller that hands in a JSDOM
 * window, because vitest's environment for this package is `node`, not
 * `jsdom` — the policy is proved against JSDOM directly rather than by
 * switching the whole package's test environment for one module.
 */
export function sanitizeRichText(
  html: string | null | undefined,
  window: WindowLike = globalThis.window as unknown as WindowLike,
): string {
  if (!html) return '';

  return purifyFor(window).sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    FORBID_TAGS: [...FORBID_TAGS],
    // Every allowed tag that gets removed anyway (nothing here is FORBID_TAGS)
    // keeps its text content; FORBID_TAGS entries are dropped root and branch
    // by DOMPurify's own FORBID_CONTENTS handling regardless of this flag.
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
  });
}
