import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AA_NORMAL_TEXT, contrastRatio } from './contrast';

const CSS_PATH = fileURLToPath(new URL('./tokens.css', import.meta.url));

/**
 * Comments are stripped BEFORE any selector lookup. The file's own doc comment
 * names all three selectors verbatim, so a naive indexOf finds the prose first
 * and then walks to the wrong opening brace — which silently parsed the light
 * palette three times and made the dark assertions vacuous.
 */
const css = readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * The token contract every downstream package relies on. If a name is added
 * or removed here, CONTRACTS.md must change with it.
 */
const REQUIRED_TOKENS = [
  'bg',
  'surface',
  'surface-2',
  'ink',
  'ink-dim',
  'line',
  'accent',
  'accent-ink',
  'accent-soft',
  'ok',
  'ok-soft',
  'warn',
  'warn-soft',
  'crit',
  'crit-soft',
  'radius',
  'scan-ground',
] as const;

type TokenName = (typeof REQUIRED_TOKENS)[number];
type Palette = Record<TokenName, string>;

/**
 * Pull one declaration block out of tokens.css by its opening selector text,
 * then read the custom properties inside it. Brace-counted rather than regexed
 * so the nested media-query block is handled correctly.
 */
function readBlock(openingSelector: string): string {
  const start = css.indexOf(openingSelector);
  if (start === -1) throw new Error(`tokens.css has no block opening with: ${openingSelector}`);

  let depth = 0;
  let i = css.indexOf('{', start);
  const bodyStart = i + 1;

  for (; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(bodyStart, i);
    }
  }

  throw new Error(`Unbalanced braces after: ${openingSelector}`);
}

function readDeclarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[match[1]!] = match[2]!.trim();
  }
  return out;
}

function toPalette(block: string, label: string): Palette {
  const declarations = readDeclarations(block);
  const palette = {} as Palette;

  for (const token of REQUIRED_TOKENS) {
    const value = declarations[token];
    if (!value) throw new Error(`${label} is missing --${token}`);
    palette[token] = value;
  }

  return palette;
}

/**
 * Bare `:root` is the first block in the file and carries the complete light
 * palette. The two dark blocks must each redefine every token so neither the
 * OS-preference path nor the explicit-toggle path can inherit a light value.
 */
const lightBlock = readBlock(':root {');
const darkMediaBlock = readBlock(":root:not([data-theme='light'])");
const darkAttrBlock = readBlock(":root[data-theme='dark']");

const light = toPalette(lightBlock, 'bare :root (light)');
const darkMedia = toPalette(darkMediaBlock, "@media dark :root:not([data-theme='light'])");
const darkAttr = toPalette(darkAttrBlock, ":root[data-theme='dark']");

/**
 * Every foreground/background pairing the primitives actually produce.
 * `on` is the background token, `fg` the token painted on top of it.
 */
const PAIRS: Array<{ fg: TokenName; on: TokenName; why: string }> = [
  // Body text on all three shell layers.
  { fg: 'ink', on: 'bg', why: 'body text on the parchment shell' },
  { fg: 'ink', on: 'surface', why: 'body text on the inset panel' },
  { fg: 'ink', on: 'surface-2', why: 'body text on zebra rows / chips' },

  // Secondary text has to clear AA too: it is used at body size for metadata.
  { fg: 'ink-dim', on: 'bg', why: 'secondary text on the shell' },
  { fg: 'ink-dim', on: 'surface', why: 'secondary text on the panel' },
  { fg: 'ink-dim', on: 'surface-2', why: 'secondary text on zebra rows' },

  // Text-level accent: links, active tab labels, selected rows.
  { fg: 'accent-ink', on: 'bg', why: 'accent text on the shell' },
  { fg: 'accent-ink', on: 'surface', why: 'accent text on the panel' },
  { fg: 'accent-ink', on: 'surface-2', why: 'accent text on zebra rows' },
  { fg: 'accent-ink', on: 'accent-soft', why: 'accent text inside an accent chip' },
  { fg: 'ink', on: 'accent-soft', why: 'body text inside an accent chip' },

  // Orange is a fill only. The label placed on it is the theme-stable near
  // black, which is why --scan-ground doubles as the on-accent ink.
  { fg: 'scan-ground', on: 'accent', why: 'primary button label on the orange fill' },

  // Status pills: coloured text on its own soft ground, and on the panels the
  // same colours are used for inline status text.
  { fg: 'ok', on: 'ok-soft', why: 'ok pill' },
  { fg: 'ok', on: 'surface', why: 'inline ok text' },
  { fg: 'ok', on: 'bg', why: 'inline ok text on the shell' },
  { fg: 'warn', on: 'warn-soft', why: 'warn pill' },
  { fg: 'warn', on: 'surface', why: 'inline warn text' },
  { fg: 'warn', on: 'bg', why: 'inline warn text on the shell' },
  { fg: 'crit', on: 'crit-soft', why: 'crit pill' },
  { fg: 'crit', on: 'surface', why: 'inline crit text' },
  { fg: 'crit', on: 'bg', why: 'inline crit text on the shell' },
];

/**
 * Overlay chrome on the media backdrop is asserted separately, against literal
 * white, because NO token works there in both themes: --scan-ground is a fixed
 * near black, while --surface and --ink each swap between light and dark. The
 * rule is therefore "media overlay text is white, dimmed with opacity".
 */
const MEDIA_OVERLAY_COLOR = '#ffffff';

const THEMES: Array<{ name: string; palette: Palette }> = [
  { name: 'light', palette: light },
  { name: 'dark (prefers-color-scheme)', palette: darkMedia },
  { name: 'dark (data-theme)', palette: darkAttr },
];

describe('design tokens', () => {
  it('defines every contract token on bare :root', () => {
    for (const token of REQUIRED_TOKENS) {
      expect(light[token], `--${token} missing from :root`).toBeTruthy();
    }
  });

  it('redefines every token in both dark blocks', () => {
    for (const token of REQUIRED_TOKENS) {
      expect(darkMedia[token], `--${token} missing from the dark media block`).toBeTruthy();
      expect(darkAttr[token], `--${token} missing from :root[data-theme='dark']`).toBeTruthy();
    }
  });

  it('keeps the two dark blocks byte-identical in value', () => {
    for (const token of REQUIRED_TOKENS) {
      expect(darkAttr[token], `--${token} differs between the two dark blocks`).toBe(
        darkMedia[token],
      );
    }
  });

  it('keeps --accent as the GUSI orange in every theme', () => {
    for (const { palette } of THEMES) {
      expect(palette.accent.toLowerCase()).toBe('#ee7625');
    }
  });

  it('proves the orange cannot be text on the light palette', () => {
    // Documents WHY --accent-ink exists, and keeps a future edit from
    // "simplifying" the two accent tokens into one. Asserted on the light
    // palette only: against the DARK surface the orange does clear AA, but the
    // rule stays "fills only" so a component cannot be correct in one theme
    // and illegible in the other.
    expect(contrastRatio(light.accent, light.surface)).toBeLessThan(AA_NORMAL_TEXT);
    expect(contrastRatio(light.accent, light.bg)).toBeLessThan(AA_NORMAL_TEXT);
  });

  it('keeps white legible on the media backdrop in every theme', () => {
    for (const { palette } of THEMES) {
      expect(contrastRatio(MEDIA_OVERLAY_COLOR, palette['scan-ground'])).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    }
  });
});

describe.each(THEMES)('$name palette meets WCAG AA', ({ palette }) => {
  it.each(PAIRS)('--$fg on --$on ($why)', ({ fg, on }) => {
    const ratio = contrastRatio(palette[fg], palette[on]);
    expect(
      Number(ratio.toFixed(2)),
      `--${fg} (${palette[fg]}) on --${on} (${palette[on]})`,
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});
