import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearDraftFiles,
  dropDraftFile,
  putDraftFile,
  putDraftSession,
  readDraftFiles,
} from './draft-blob-store';

function blob(text: string): Blob {
  return new Blob([text], { type: 'video/mp4' });
}

async function textOf(value: Blob): Promise<string> {
  return typeof value.text === 'function' ? value.text() : '';
}

beforeEach(() => {
  // A fresh factory per test: the store opens and closes its own connection on
  // every call, so nothing leaks between them except the data itself.
  globalThis.indexedDB = new IDBFactory();
});

describe('draft blob store', () => {
  it('round-trips the bytes of an unfinished file', async () => {
    await putDraftFile('draft-1', 'file-a', blob('aaa'));

    const records = await readDraftFiles('draft-1');

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ draftId: 'draft-1', fileId: 'file-a', session: null });
    expect(await textOf(records[0]!.blob)).toBe('aaa');
  });

  it('keeps two drafts apart, so two tabs do not overwrite each other', async () => {
    await putDraftFile('draft-1', 'file-a', blob('one'));
    await putDraftFile('draft-2', 'file-a', blob('two'));

    expect(await readDraftFiles('draft-1')).toHaveLength(1);
    expect(await textOf((await readDraftFiles('draft-2'))[0]!.blob)).toBe('two');
  });

  it('updates the transfer position without rewriting the bytes', async () => {
    // Called after every accepted part, so it must not rewrite a 28 MB blob
    // each time.
    await putDraftFile('draft-1', 'file-a', blob('bytes'));
    await putDraftSession('draft-1', 'file-a', {
      uploadId: 'u1',
      key: 'storage/x',
      etags: { 1: 'etag-one', 2: 'etag-two' },
    });

    const [record] = await readDraftFiles('draft-1');
    expect(record?.session?.uploadId).toBe('u1');
    expect(record?.session?.etags).toEqual({ 1: 'etag-one', 2: 'etag-two' });
    expect(await textOf(record!.blob)).toBe('bytes');
  });

  it('ignores a session for a file that has already finished', async () => {
    await putDraftSession('draft-1', 'gone', {
      uploadId: 'u1',
      key: 'storage/x',
      etags: {},
    });

    expect(await readDraftFiles('draft-1')).toEqual([]);
  });

  it('drops one file when its upload completes', async () => {
    await putDraftFile('draft-1', 'file-a', blob('a'));
    await putDraftFile('draft-1', 'file-b', blob('b'));

    await dropDraftFile('draft-1', 'file-a');

    expect((await readDraftFiles('draft-1')).map((record) => record.fileId)).toEqual(['file-b']);
  });

  it('clears a whole draft and leaves the other alone', async () => {
    await putDraftFile('draft-1', 'file-a', blob('a'));
    await putDraftFile('draft-1', 'file-b', blob('b'));
    await putDraftFile('draft-2', 'file-c', blob('c'));

    await clearDraftFiles('draft-1');

    expect(await readDraftFiles('draft-1')).toEqual([]);
    expect(await readDraftFiles('draft-2')).toHaveLength(1);
  });

  it('degrades to a no-op when IndexedDB is unavailable', async () => {
    // Private modes genuinely refuse it, and a refusal is not a reason to
    // break the page — the app falls back to asking for the file again.
    // @ts-expect-error deliberately removing the global under test
    globalThis.indexedDB = undefined;

    await expect(putDraftFile('draft-1', 'file-a', blob('a'))).resolves.toBeUndefined();
    await expect(readDraftFiles('draft-1')).resolves.toEqual([]);
    await expect(dropDraftFile('draft-1', 'file-a')).resolves.toBeUndefined();
    await expect(clearDraftFiles('draft-1')).resolves.toBeUndefined();
  });

  it('degrades to a no-op when opening the database throws', async () => {
    globalThis.indexedDB = {
      open: () => {
        throw new Error('SecurityError');
      },
    } as unknown as IDBFactory;

    await expect(putDraftFile('draft-1', 'file-a', blob('a'))).resolves.toBeUndefined();
    await expect(readDraftFiles('draft-1')).resolves.toEqual([]);
  });
});

describe('a database that exists without the store', () => {
  it('repairs itself rather than silently doing nothing forever', async () => {
    // onupgradeneeded only fires on a version CHANGE, so a database created at
    // this version by something that did not make the store would otherwise
    // leave every call here throwing and swallowing, permanently.
    await new Promise<void>((resolve) => {
      const request = globalThis.indexedDB.open('scanvault.create-scan', 1);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => resolve();
    });

    await putDraftFile('draft-1', 'file-a', blob('recovered'));

    const records = await readDraftFiles('draft-1');
    expect(records).toHaveLength(1);
    expect(await textOf(records[0]!.blob)).toBe('recovered');
  });
});
