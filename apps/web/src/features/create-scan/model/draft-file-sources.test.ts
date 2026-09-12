import { describe, expect, it, vi } from 'vitest';

import type { DraftFile, DraftFileStatus } from './draft-types';
import {
  revokeAllObjectUrls,
  syncObjectUrls,
  viewableDraftFiles,
  type ObjectUrlMap,
} from './draft-file-sources';

function file(id: string, options: { blob?: boolean; status?: DraftFileStatus } = {}): DraftFile {
  return {
    id,
    name: `${id}.mp4`,
    size: 1,
    type: 'video/mp4',
    status: options.status ?? 'stored',
    blob: options.blob === false ? null : ({ size: 1 } as unknown as File),
  } as unknown as DraftFile;
}

function factoryWithCounter() {
  let next = 0;
  return {
    create: vi.fn(() => `blob:local/${next++}`),
    revoke: vi.fn(),
  };
}

describe('syncObjectUrls', () => {
  it('creates one URL per file and reuses it across calls', () => {
    const factory = factoryWithCounter();
    const urls: ObjectUrlMap = new Map();

    const first = syncObjectUrls([file('a'), file('b')], urls, factory);
    const second = syncObjectUrls([file('a'), file('b')], urls, factory);

    // Creating per render leaks a blob URL per frame; on a 148 MB study that
    // is hundreds of megabytes within seconds of typing in the note field.
    expect(factory.create).toHaveBeenCalledTimes(2);
    expect(second.map((source) => source.url)).toEqual(first.map((source) => source.url));
  });

  it('revokes the URL of a file that has gone', () => {
    const factory = factoryWithCounter();
    const urls: ObjectUrlMap = new Map();

    const [, removed] = syncObjectUrls([file('a'), file('b')], urls, factory);
    syncObjectUrls([file('a')], urls, factory);

    expect(factory.revoke).toHaveBeenCalledWith(removed?.url);
    expect(urls.size).toBe(1);
  });

  it('releases the URL when the draft drops a blob after upload', () => {
    const factory = factoryWithCounter();
    const urls: ObjectUrlMap = new Map();

    syncObjectUrls([file('a')], urls, factory);
    const after = syncObjectUrls([file('a', { blob: false })], urls, factory);

    expect(factory.revoke).toHaveBeenCalledTimes(1);
    expect(after[0]?.url).toBeNull();
    expect(urls.size).toBe(0);
  });

  it('gives a detached file a null url, which the stage already explains', () => {
    const urls: ObjectUrlMap = new Map();
    const sources = syncObjectUrls(
      [file('a', { blob: false, status: 'detached' })],
      urls,
      factoryWithCounter(),
    );

    expect(sources).toEqual([
      { id: 'a', filename: 'a.mp4', filetype: 'video/mp4', url: null, filesize: 1 },
    ]);
  });

  it('carries the fields the stage resolves a media kind from', () => {
    const sources = syncObjectUrls([file('a')], new Map(), factoryWithCounter());
    expect(sources[0]).toMatchObject({ filename: 'a.mp4', filetype: 'video/mp4' });
  });

  it('repeated add and remove leaves nothing behind', () => {
    const factory = factoryWithCounter();
    const urls: ObjectUrlMap = new Map();

    for (let round = 0; round < 5; round += 1) {
      syncObjectUrls([file(`f${round}`)], urls, factory);
    }

    expect(urls.size).toBe(1);
    expect(factory.revoke).toHaveBeenCalledTimes(4);
  });
});

describe('revokeAllObjectUrls', () => {
  it('releases everything and empties the map', () => {
    const factory = factoryWithCounter();
    const urls: ObjectUrlMap = new Map();
    syncObjectUrls([file('a'), file('b')], urls, factory);

    revokeAllObjectUrls(urls, factory);

    expect(factory.revoke).toHaveBeenCalledTimes(2);
    expect(urls.size).toBe(0);
  });
});

describe('viewableDraftFiles', () => {
  it('leaves out what is not part of the study', () => {
    const files = [
      file('a'),
      file('b', { status: 'rejected' }),
      file('c', { status: 'cancelled' }),
      file('d', { status: 'uploading' }),
    ];

    expect(viewableDraftFiles(files).map((item) => item.id)).toEqual(['a', 'd']);
  });
});
