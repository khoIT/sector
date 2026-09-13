import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import {
  ANSWER_TITLE_IS_AN_IFRAME,
  HAND_BUILT_EVENT_HANDLER_AND_JAVASCRIPT_URL,
  MIXED_HTTP_AND_HTTPS_IMAGES,
  QUESTION_BODY_WITH_INLINE_STYLE_SPAN,
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
  it('drops the <script> tag and its src, keeps the surrounding iframe wrapper only as text', () => {
    const clean = sanitize(VIMEO_IFRAME_WITH_SCRIPT);

    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('player.js');
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('player.vimeo.com');
    // The real teaching content around the embed is not collateral damage.
    expect(clean).toContain('Introduction to US Guided Injections');
    expect(clean).toContain('Anchor probe hand for better control');
  });

  it('strips inline style and class from every element, including the wrapper div', () => {
    const clean = sanitize(VIMEO_IFRAME_WITH_SCRIPT);

    expect(clean).not.toMatch(/style\s*=/);
    expect(clean).not.toMatch(/class\s*=/);
  });

  it('removes a WordPress block comment and the iframe inside it, keeps the real list content', () => {
    const clean = sanitize(YOUTUBE_IFRAME_IN_WP_BLOCK_COMMENT);

    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('youtube.com');
    expect(clean).not.toContain('wp:html');
    expect(clean).toContain('Hover over the');
    expect(clean).toContain('Estimates');
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

  it('strips an iframe used as an entire answer title down to nothing renderable', () => {
    const clean = sanitize(ANSWER_TITLE_IS_AN_IFRAME);
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('youtube.com');
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
