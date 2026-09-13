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
 *   - `<script>`, `<style>`, `<iframe>`, `<object>` and `<embed>` are removed
 *     entirely, contents and all — never converted into a player. Video goes
 *     on to become a first-party GUSI media surface later; it does not come
 *     from re-embedding whatever a WordPress author's `<script src>` pointed
 *     at in 2019.
 *   - Images only render from an `https://` `src`. A `data:`, `http://` or
 *     protocol-relative image is dropped (the whole element, not just the
 *     attribute — a broken-image icon is worse than no image).
 *   - A link whose `href` is an absolute `http(s)://` URL is forced to
 *     `target="_blank" rel="noopener noreferrer"`, because it is leaving
 *     GUSI. A relative link (the nested-table fixture links back into
 *     `/dashboard/...`) is left alone — it is internal navigation, not an
 *     external hop, and does not need a new tab.
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
] as const;

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'colspan', 'rowspan'] as const;

const FORBID_TAGS = ['script', 'style', 'iframe', 'object', 'embed'] as const;

/** `https://…` only. Relative, `http://`, `data:` and protocol-relative all fail. */
function isHttpsUrl(value: string): boolean {
  return /^https:\/\//i.test(value.trim());
}

/** An absolute `http(s)://` URL leaves the app; a relative path stays inside it. */
function isExternalHref(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
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
      if (href && isExternalHref(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      } else {
        node.removeAttribute('target');
        node.removeAttribute('rel');
      }
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
