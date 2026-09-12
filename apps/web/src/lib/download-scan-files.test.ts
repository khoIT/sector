import { describe, expect, it, vi } from 'vitest';

import {
  fetchScanFiles,
  safeFilename,
  uniqueFilenames,
  zipFilename,
} from './download-scan-files';

describe('uniqueFilenames', () => {
  it('leaves distinct names alone', () => {
    expect(uniqueFilenames(['a.png', 'b.mp4'])).toEqual(['a.png', 'b.mp4']);
  });

  it('suffixes a repeat before its extension, so the zip keeps both files', () => {
    expect(uniqueFilenames(['clip.mp4', 'clip.mp4', 'clip.mp4'])).toEqual([
      'clip.mp4',
      'clip (2).mp4',
      'clip (3).mp4',
    ]);
  });

  it('suffixes at the end when there is no extension', () => {
    expect(uniqueFilenames(['scan', 'scan'])).toEqual(['scan', 'scan (2)']);
  });

  it('treats a leading dot as part of the name, not an extension', () => {
    expect(uniqueFilenames(['.hidden', '.hidden'])).toEqual(['.hidden', '.hidden (2)']);
  });

  it('substitutes a name for a blank one', () => {
    expect(uniqueFilenames(['   ', '  '])).toEqual(['file', 'file (2)']);
  });
});

describe('zipFilename', () => {
  it('uses the scan title', () => {
    expect(zipFilename('AAA-JAN6-00011')).toBe('AAA-JAN6-00011.zip');
  });

  it('strips characters a filesystem will not take', () => {
    expect(zipFilename('Lung: left/right?')).toBe('Lung- left-right-.zip');
  });

  it('falls back when the title is empty', () => {
    expect(zipFilename('   ')).toBe('scan.zip');
  });
});

const ok = (body: string) => ({ ok: true, blob: async () => new Blob([body]) }) as Response;
const forbidden = { ok: false, blob: async () => new Blob() } as Response;

describe('fetchScanFiles', () => {
  it('fetches every file', async () => {
    const fetchImpl = vi.fn(async () => ok('bytes'));
    const result = await fetchScanFiles(
      [
        { url: 'https://cdn/1', filename: 'a.png' },
        { url: 'https://cdn/2', filename: 'b.png' },
      ],
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.fetched.map((f) => f.filename)).toEqual(['a.png', 'b.png']);
    expect(result.failed).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('keeps the files that worked and names the ones that did not', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith('2') ? forbidden : ok('bytes'),
    );
    const result = await fetchScanFiles(
      [
        { url: 'https://cdn/1', filename: 'a.png' },
        { url: 'https://cdn/2', filename: 'expired.png' },
        { url: 'https://cdn/3', filename: 'c.png' },
      ],
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.fetched.map((f) => f.filename)).toEqual(['a.png', 'c.png']);
    expect(result.failed).toEqual(['expired.png']);
  });

  it('treats a thrown request as a failed file rather than failing the batch', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('1')) throw new TypeError('network');
      return ok('bytes');
    });
    const result = await fetchScanFiles(
      [
        { url: 'https://cdn/1', filename: 'a.png' },
        { url: 'https://cdn/2', filename: 'b.png' },
      ],
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.failed).toEqual(['a.png']);
    expect(result.fetched).toHaveLength(1);
  });

  it('reports failures under the de-duplicated name the archive would have used', async () => {
    const fetchImpl = vi.fn(async () => forbidden);
    const result = await fetchScanFiles(
      [
        { url: 'https://cdn/1', filename: 'clip.mp4' },
        { url: 'https://cdn/2', filename: 'clip.mp4' },
      ],
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.failed).toEqual(['clip.mp4', 'clip (2).mp4']);
  });

  it('returns nothing for an empty file list without calling fetch', async () => {
    const fetchImpl = vi.fn();
    const result = await fetchScanFiles([], fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ fetched: [], failed: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('safeFilename', () => {
  it('flattens a path traversal into one segment', () => {
    expect(safeFilename('../../../evil.mp4')).toBe('evil.mp4');
    expect(safeFilename('a/b/c.png')).toBe('c.png');
    expect(safeFilename('..\\..\\evil.mp4')).toBe('evil.mp4');
  });

  it('strips characters a filesystem rejects', () => {
    expect(safeFilename('sca:n?.png')).toBe('sca-n-.png');
  });

  it('keeps an ordinary name intact', () => {
    expect(safeFilename('DVT-29FEB-2704.jpg')).toBe('DVT-29FEB-2704.jpg');
  });

  it('falls back when nothing usable survives', () => {
    expect(safeFilename('../')).toBe('file');
    expect(safeFilename('..')).toBe('file');
    expect(safeFilename('   ')).toBe('file');
  });

  it('keeps a leading dot, which is a real filename and not a traversal', () => {
    expect(safeFilename('.hidden')).toBe('.hidden');
  });
});

describe('uniqueFilenames sanitises before de-duplicating', () => {
  it('treats two traversal names that flatten to the same file as duplicates', () => {
    expect(uniqueFilenames(['../a.png', 'a.png'])).toEqual(['a.png', 'a (2).png']);
  });
});
