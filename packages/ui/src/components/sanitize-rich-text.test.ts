import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import {
  ANSWER_TITLE_IS_AN_IFRAME,
  ESONO_CATALOG_IFRAME_EMBED,
  HAND_BUILT_EVENT_HANDLER_AND_JAVASCRIPT_URL,
  IFRAME_FROM_AN_UNLISTED_HOST,
  IFRAME_ON_ALLOWED_HOST_BUT_HTTP,
  MIXED_HTTP_AND_HTTPS_IMAGES,
  QUESTION_BODY_WITH_INLINE_STYLE_SPAN,
  QUESTION_WITH_NATIVE_VIDEO_CLIP,
  STYLED_TABLE_WITH_INTERNAL_LINK,
  VIMEO_IFRAME_WITH_SCRIPT,
  WORDPRESS_SHORTCODE_REMNANT,
  YOUTUBE_IFRAME_IN_WP_BLOCK_COMMENT,
} from './fixtures/rich-text-samples';
import { sanitizeRichText } from './sanitize-rich-text';

/**
 * The vitest environment for this package is `node` (see vitest.config.ts),
 * so the sanitiser is proved against a JSDOM window built once here rather
 * than the browser global `window` the real app supplies at runtime — the
 * policy is identical either way, since `sanitizeRichText` only ever touches
 * the window it is handed.
 */
const window = new JSDOM('').window as unknown as Parameters<typeof sanitizeRichText>[1];

function sanitize(html: string): string {
  return sanitizeRichText(html, window);
}

describe('sanitizeRichText against real migrated content', () => {
  it('keeps a Vimeo iframe (allow-listed host), sandboxed, drops its glued-on <script>', () => {
    const clean = sanitize(VIMEO_IFRAME_WITH_SCRIPT);

    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('player.js');
    expect(clean).toContain('<iframe');
    expect(clean).toContain('src="https://player.vimeo.com/video/698028055');
    expect(clean).toMatch(/sandbox="allow-scripts allow-same-origin allow-presentation"/);
    // The real teaching content around the embed is not collateral damage.
    expect(clean).toContain('Introduction to US Guided Injections');
    expect(clean).toContain('Anchor probe hand for better control');
  });

  it('strips inline style and class from every element, including the iframe and the wrapper div', () => {
    const clean = sanitize(VIMEO_IFRAME_WITH_SCRIPT);

    expect(clean).not.toMatch(/style\s*=/);
    expect(clean).not.toMatch(/class\s*=/);
  });

  it('removes a WordPress block comment, keeps the allow-listed YouTube iframe inside it', () => {
    const clean = sanitize(YOUTUBE_IFRAME_IN_WP_BLOCK_COMMENT);

    expect(clean).toContain('<iframe');
    expect(clean).toContain('src="https://www.youtube.com/embed/OvO-VmZ-KIA"');
    expect(clean).not.toContain('wp:html');
    expect(clean).toContain('Hover over the');
    expect(clean).toContain('Estimates');
  });

  it('keeps GUSI’s own esono.online catalog iframe, sandboxed the same way', () => {
    const clean = sanitize(ESONO_CATALOG_IFRAME_EMBED);

    expect(clean).toContain('src="https://esono.online/gusi-catalog/');
    expect(clean).toMatch(/sandbox="allow-scripts allow-same-origin allow-presentation"/);
    expect(clean).not.toMatch(/style\s*=/);
  });

  it('keeps a native <video>/<source> clip a question asks the learner about', () => {
    const clean = sanitize(QUESTION_WITH_NATIVE_VIDEO_CLIP);

    expect(clean).toContain('<video');
    expect(clean).toContain('controls="controls"');
    expect(clean).toContain(
      '<source src="https://legacywp-content.s3.ap-southeast-1.amazonaws.com/wp-content/uploads/2024/01/AAA_with_Thrombus1__Short_Axis__normalized.mp4" type="video/mp4">',
    );
    expect(clean).toContain('The following image suggests');
    expect(clean).not.toContain('autoplay');
  });

  it('removes an iframe from a host that is not on the allow-list, element and all', () => {
    const clean = sanitize(IFRAME_FROM_AN_UNLISTED_HOST);

    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('evil.example.com');
    expect(clean).toContain('Before');
    expect(clean).toContain('After');
  });

  it('removes an http (not https) iframe even on an allow-listed host', () => {
    const clean = sanitize(IFRAME_ON_ALLOWED_HOST_BUT_HTTP);
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('player.vimeo.com');
  });

  it('leaves an inert WordPress shortcode exactly as authored — it was never a tag', () => {
    expect(sanitize(WORDPRESS_SHORTCODE_REMNANT)).toBe(WORDPRESS_SHORTCODE_REMNANT);
  });

  it('keeps a nested table and an internal relative link untouched by the external-link rule', () => {
    const clean = sanitize(STYLED_TABLE_WITH_INTERNAL_LINK);

    expect(clean).toContain('<table>');
    expect(clean).toContain('<td>');
    expect(clean).not.toMatch(/style\s*=/);
    // Internal navigation: no forced new tab, no rel injected.
    expect(clean).toContain('href="/dashboard/');
    expect(clean).not.toContain('target=');
    expect(clean).not.toContain('rel=');
  });

  it('keeps an https image inside that same table', () => {
    const clean = sanitize(STYLED_TABLE_WITH_INTERNAL_LINK);
    expect(clean).toContain('<img');
    expect(clean).toContain('src="https://legacywp-content.s3.ap-southeast-1.amazonaws.com');
  });

  it('drops a Word-paste inline style attribute but keeps the question text', () => {
    const clean = sanitize(QUESTION_BODY_WITH_INLINE_STYLE_SPAN);

    expect(clean).not.toMatch(/style\s*=/);
    expect(clean).toContain('What is the best orientation to measure a AAA?');
  });

  it('keeps an iframe used as an entire answer title — the answer IS the clip', () => {
    const clean = sanitize(ANSWER_TITLE_IS_AN_IFRAME);
    expect(clean).toContain('<iframe');
    expect(clean).toContain('src="https://www.youtube.com/embed/CHImlpUxg9w"');
    expect(clean).toMatch(/sandbox="allow-scripts allow-same-origin allow-presentation"/);
  });

  it('removes an inline event handler attribute and a javascript: URL, keeps a safe external link', () => {
    const clean = sanitize(HAND_BUILT_EVENT_HANDLER_AND_JAVASCRIPT_URL);

    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('alert(');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('Tap here');
    // The javascript: anchor loses its href but the safe one keeps its own.
    expect(clean).toContain('href="https://gusi.org/safe"');
  });

  it('forces target=_blank and rel=noopener noreferrer on the surviving external link', () => {
    const clean = sanitize(HAND_BUILT_EVENT_HANDLER_AND_JAVASCRIPT_URL);
    expect(clean).toMatch(/href="https:\/\/gusi\.org\/safe"[^>]*target="_blank"/);
    expect(clean).toMatch(/rel="noopener noreferrer"/);
  });

  it('keeps an https image and removes an http one, element and all', () => {
    const clean = sanitize(MIXED_HTTP_AND_HTTPS_IMAGES);

    expect(clean).not.toContain('insecure.png');
    expect(clean).not.toContain('http://example.com');
    expect(clean).toContain('src="https://example.com/secure.png"');
  });
});

describe('sanitizeRichText edge cases', () => {
  it('returns an empty string for empty, null or undefined input', () => {
    expect(sanitize('')).toBe('');
    expect(sanitizeRichText(null, window)).toBe('');
    expect(sanitizeRichText(undefined, window)).toBe('');
  });

  it('removes <style>, <object> and <embed> tags entirely', () => {
    const clean = sanitize(
      '<style>body{background:red}</style><object data="x"></object><embed src="x"/><p>kept</p>',
    );
    expect(clean).not.toContain('<style');
    expect(clean).not.toContain('<object');
    expect(clean).not.toContain('<embed');
    expect(clean).toBe('<p>kept</p>');
  });

  it('keeps ordinary headings, lists, emphasis, blockquote and code untouched in shape', () => {
    const html =
      '<h2>Title</h2><p>Body <strong>bold</strong> <em>em</em></p>' +
      '<ul><li>one</li><li>two</li></ul><blockquote>quoted</blockquote><code>x = 1</code>';
    expect(sanitize(html)).toBe(html);
  });
});

/**
 * Authored bodies carry 1,060 absolute links back to this product's own
 * former hostname — every one of them under `/dashboard/`. Left as external
 * links they open a retired host in a new tab and the router never sees the
 * click, which is the whole reason lesson bodies stopped being the module
 * page's navigation.
 */
describe('sanitizeRichText on links back to this app', () => {
  it('rewrites an absolute link to the old host into a relative path', () => {
    const clean = sanitize(
      '<p><a href="https://scanhub.upscan.com/dashboard/my-courses/681a4b63">Course</a></p>',
    );

    expect(clean).toContain('href="/dashboard/my-courses/681a4b63"');
    expect(clean).not.toContain('scanhub.upscan.com');
  });

  it('leaves a rewritten link in this tab', () => {
    const clean = sanitize('<a href="https://scanhub.upscan.com/dashboard/account">Account</a>');

    expect(clean).not.toContain('_blank');
    expect(clean).not.toContain('rel=');
  });

  it('keeps the query string and fragment of a legacy deep link', () => {
    const clean = sanitize(
      '<a href="https://scanhub.upscan.com/dashboard/scans?filter=mine#results">Scans</a>',
    );

    expect(clean).toContain('href="/dashboard/scans?filter=mine#results"');
  });

  it('is not fooled by a hostname that merely starts with the real one', () => {
    const clean = sanitize(
      '<a href="https://scanhub.upscan.com.evil.test/dashboard/account">Account</a>',
    );

    // Still absolute, still treated as what it is: somewhere else entirely.
    expect(clean).toContain('href="https://scanhub.upscan.com.evil.test/dashboard/account"');
    expect(clean).toContain('_blank');
  });

  it('still sends a genuinely external link to a new tab', () => {
    const clean = sanitize('<a href="https://pubmed.ncbi.nlm.nih.gov/12345678/">Reference</a>');

    expect(clean).toMatch(/href="https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/12345678\/"/);
    expect(clean).toContain('_blank');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it('leaves an already-relative link alone', () => {
    const clean = sanitize('<a href="/learn/courses">My Courses</a>');

    expect(clean).toBe('<a href="/learn/courses">My Courses</a>');
  });
});
