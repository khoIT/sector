import { describe, expect, it } from 'vitest';

import { decodeHtmlEntities } from './decode-html-entities';

describe('decodeHtmlEntities', () => {
  it('decodes the entity the imported course titles actually carry', () => {
    expect(decodeHtmlEntities('Renal &amp; Bladder PreCourse')).toBe('Renal & Bladder PreCourse');
  });

  it('decodes numeric and hex references', () => {
    expect(decodeHtmlEntities('2nd &#38; 3rd')).toBe('2nd & 3rd');
    expect(decodeHtmlEntities('2nd &#x26; 3rd')).toBe('2nd & 3rd');
  });

  it('leaves a string with no entities exactly as it was', () => {
    const plain = 'FAST/E-FAST';
    expect(decodeHtmlEntities(plain)).toBe(plain);
  });

  it('leaves an unknown entity alone rather than guessing', () => {
    expect(decodeHtmlEntities('a &frobnicate; b')).toBe('a &frobnicate; b');
  });

  it('does not decode a bare ampersand into anything', () => {
    expect(decodeHtmlEntities('Fish & Chips')).toBe('Fish & Chips');
  });
});
