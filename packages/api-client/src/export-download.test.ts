import { describe, expect, it } from 'vitest';

import { exportFileToBlob } from './export-download';

describe('exportFileToBlob', () => {
  it('decodes base64 bytes back to their original content', async () => {
    const original = 'the quick brown fox';
    const base64 = Buffer.from(original, 'utf8').toString('base64');

    const blob = exportFileToBlob({
      buffer: base64,
      contentType: 'text/plain',
    });

    expect(blob.type).toBe('text/plain');
    const decoded = await blob.text();
    expect(decoded).toBe(original);
  });

  it('preserves the exact byte length for binary content', async () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    const base64 = Buffer.from(bytes).toString('base64');

    const blob = exportFileToBlob({
      buffer: base64,
      contentType: 'application/octet-stream',
    });

    const roundTrip = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(roundTrip)).toEqual(Array.from(bytes));
  });
});
