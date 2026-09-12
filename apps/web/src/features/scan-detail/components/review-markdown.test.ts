import { describe, expect, it } from 'vitest';

import { parseInline, parseReviewMarkdown } from './review-markdown';

describe('parseInline', () => {
  it('leaves plain text alone', () => {
    expect(parseInline('No free fluid seen.')).toEqual([{ text: 'No free fluid seen.' }]);
  });

  it('reads bold and keeps what surrounds it', () => {
    expect(parseInline('The **RUQ** view is adequate.')).toEqual([
      { text: 'The ' },
      { text: 'RUQ', bold: true },
      { text: ' view is adequate.' },
    ]);
  });

  it('reads both italic spellings', () => {
    expect(parseInline('*one* and _two_')).toEqual([
      { text: 'one', italic: true },
      { text: ' and ' },
      { text: 'two', italic: true },
    ]);
  });

  // Bold is two stars; reading it as two italics would drop the inner stars
  // and change the emphasis.
  it('prefers bold over italic on a double marker', () => {
    expect(parseInline('**x**')).toEqual([{ text: 'x', bold: true }]);
  });

  it('keeps an unmatched marker as text rather than swallowing the line', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ text: '2 * 3 = 6' }]);
  });

  it('answers with one empty span for an empty line', () => {
    expect(parseInline('')).toEqual([{ text: '' }]);
  });
});

describe('parseReviewMarkdown', () => {
  it('reads the three heading levels', () => {
    const blocks = parseReviewMarkdown('# One\n## Two\n### Three');
    expect(blocks.map((block) => (block.kind === 'heading' ? block.level : null))).toEqual([
      1, 2, 3,
    ]);
  });

  it('joins a hard-wrapped paragraph into one', () => {
    expect(parseReviewMarkdown('the liver is\nnormal in size')).toEqual([
      { kind: 'paragraph', spans: [{ text: 'the liver is normal in size' }] },
    ]);
  });

  it('splits paragraphs on a blank line', () => {
    expect(parseReviewMarkdown('one\n\ntwo')).toHaveLength(2);
  });

  it('groups consecutive bullets into one list', () => {
    const blocks = parseReviewMarkdown('- a\n- b\n* c');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      kind: 'list',
      ordered: false,
      items: [[{ text: 'a' }], [{ text: 'b' }], [{ text: 'c' }]],
    });
  });

  it('reads a numbered list as ordered', () => {
    const blocks = parseReviewMarkdown('1. first\n2) second');
    expect(blocks[0]).toEqual({
      kind: 'list',
      ordered: true,
      items: [[{ text: 'first' }], [{ text: 'second' }]],
    });
  });

  // Otherwise a numbered list following bullets is silently folded into them
  // and the numbering disappears.
  it('starts a new list when the kind changes', () => {
    const blocks = parseReviewMarkdown('- a\n1. b');
    expect(blocks.map((block) => (block.kind === 'list' ? block.ordered : null))).toEqual([
      false,
      true,
    ]);
  });

  it('ends a list at a heading', () => {
    const blocks = parseReviewMarkdown('- a\n## Next\n- b');
    expect(blocks.map((block) => block.kind)).toEqual(['list', 'heading', 'list']);
  });

  it('carries inline emphasis into headings and list items', () => {
    const blocks = parseReviewMarkdown('## **Impression**\n- see **RUQ**');
    expect(blocks[0]).toEqual({
      kind: 'heading',
      level: 2,
      spans: [{ text: 'Impression', bold: true }],
    });
    expect(blocks[1]).toEqual({
      kind: 'list',
      ordered: false,
      items: [[{ text: 'see ' }, { text: 'RUQ', bold: true }]],
    });
  });

  // A table or a code fence is outside the subset. Losing the line entirely
  // would hide a paragraph of a clinical review; showing it verbatim does not.
  it('keeps unsupported syntax as literal text', () => {
    expect(parseReviewMarkdown('| a | b |')).toEqual([
      { kind: 'paragraph', spans: [{ text: '| a | b |' }] },
    ]);
  });

  it('reads nothing out of an empty body', () => {
    expect(parseReviewMarkdown('')).toEqual([]);
    expect(parseReviewMarkdown('\n\n  \n')).toEqual([]);
  });

  it('normalises windows line endings', () => {
    expect(parseReviewMarkdown('a\r\n\r\nb')).toHaveLength(2);
  });
});
