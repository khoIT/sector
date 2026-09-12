/**
 * A strict-subset markdown reader for AI-written review bodies.
 *
 * Nine thousand of the fifteen thousand reviews in the database carry a
 * `reviewMD`, and this app rendered none of them. The legacy dashboard uses
 * react-markdown, but styles exactly seven elements — h1-h3, p, ul, ol, li,
 * strong, em — and the generator writes nothing else. Parsing that subset here
 * keeps a ten-package dependency out of an app that has deliberately stayed
 * small, and keeps the rules testable: the package's vitest runs in a node
 * environment over `src/**\/*.test.ts`.
 *
 * The output is data, not HTML. The renderer builds React elements from it, so
 * there is no `dangerouslySetInnerHTML` anywhere and nothing in a review body
 * can inject markup.
 *
 * Anything the subset does not cover — tables, code fences, links, images —
 * survives as its own literal text rather than disappearing. A reviewer
 * reading an odd line is recoverable; a reviewer silently missing a paragraph
 * is not.
 */

export type InlineSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

export type MarkdownBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; spans: InlineSpan[] }
  | { kind: 'paragraph'; spans: InlineSpan[] }
  | { kind: 'list'; ordered: boolean; items: InlineSpan[][] };

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

/** `**bold**`, `*italic*`, `_italic_`. Nesting is not supported, nor written. */
export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g;
  let index = 0;

  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > index) spans.push({ text: text.slice(index, match.index) });

    if (match[1] !== undefined) spans.push({ text: match[1], bold: true });
    else spans.push({ text: (match[2] ?? match[3]) as string, italic: true });

    index = match.index + match[0].length;
  }

  if (index < text.length) spans.push({ text: text.slice(index) });
  return spans.length > 0 ? spans : [{ text }];
}

/**
 * Blocks, in order.
 *
 * Consecutive list items of the same kind join one list; a blank line, a
 * heading or a change of kind ends it. Paragraphs run until a blank line, and
 * their lines are joined with a space — a hard-wrapped paragraph is one
 * paragraph, which is what every markdown reader does and what the generator
 * assumes.
 */
export function parseReviewMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: InlineSpan[][] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: 'paragraph', spans: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push({ kind: 'list', ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();

    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: 'heading',
        level: (heading[1] as string).length as 1 | 2 | 3,
        spans: parseInline((heading[2] as string).trim()),
      });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push(parseInline(((bullet ?? numbered) as RegExpExecArray)[1] as string));
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return blocks;
}
