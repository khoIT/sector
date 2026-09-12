import { describe, expect, it } from 'vitest';

import { playableSources, type StageSource } from './media-source';

function source(id: string, url: string | null): StageSource {
  return { id, filename: `${id}.jpg`, filetype: 'image/jpeg', url };
}

describe('playableSources', () => {
  // 17.6% of scans in the local database carry at least one file whose upload
  // never finished. Those arrive with a null url, and paging through them gave
  // the reviewer blank frames inside a count that treated them as content.
  it('drops files whose bytes never reached storage', () => {
    expect(playableSources([source('a', 'https://cdn/a'), source('b', null)])).toEqual([
      source('a', 'https://cdn/a'),
    ]);
  });

  it('keeps every file when they all have bytes', () => {
    const files = [source('a', 'https://cdn/a'), source('b', 'https://cdn/b')];
    expect(playableSources(files)).toEqual(files);
  });

  it('can empty the list, which the viewer reads as nothing to show', () => {
    expect(playableSources([source('a', null)])).toEqual([]);
  });

  it('preserves order, because the strip is positional', () => {
    const files = [source('a', 'u'), source('b', null), source('c', 'u')];
    expect(playableSources(files).map((file) => file.id)).toEqual(['a', 'c']);
  });
});
