import { describe, expect, it } from 'vitest';

import { hasProcessingScan, SCAN_STATUSES, scanStatusTone, uploadOutcomeFor } from './scan-status';
import { buildScanFilekey, extractFilekey, sanitizeFilename } from './upload-keys';

describe('hasProcessingScan', () => {
  it('is false for undefined and for an empty list', () => {
    expect(hasProcessingScan(undefined)).toBe(false);
    expect(hasProcessingScan([])).toBe(false);
  });

  it('is true when any row is processing', () => {
    expect(
      hasProcessingScan([{ status: 'submitted' }, { status: 'processing' }, { status: 'reviewed' }]),
    ).toBe(true);
  });

  it('is false when nothing is processing', () => {
    expect(hasProcessingScan([{ status: 'submitted' }, { status: 'reviewed' }])).toBe(false);
  });
});

describe('uploadOutcomeFor', () => {
  it('is not done for a missing scan', () => {
    expect(uploadOutcomeFor(undefined)).toEqual({ done: false });
  });

  it('is not done while pending or processing', () => {
    // The bytes reaching S3 is not success: render and de-identify run after.
    expect(uploadOutcomeFor({ status: 'pending' })).toEqual({ done: false });
    expect(uploadOutcomeFor({ status: 'processing' })).toEqual({ done: false });
  });

  it('reports a failure with the server-side reason', () => {
    expect(uploadOutcomeFor({ status: 'failed', processingError: 'de-identify crashed' })).toEqual({
      done: true,
      failed: true,
      error: 'de-identify crashed',
    });
  });

  it('reports success for every other terminal status', () => {
    expect(uploadOutcomeFor({ status: 'submitted' })).toEqual({ done: true, failed: false });
    expect(uploadOutcomeFor({ status: 'partially_uploaded' })).toEqual({
      done: true,
      failed: false,
    });
  });
});

describe('scanStatusTone', () => {
  it('assigns a tone to every status in the enum', () => {
    for (const status of SCAN_STATUSES) {
      expect(scanStatusTone(status)).toBeTruthy();
    }
  });

  it('marks both failure statuses critical', () => {
    expect(scanStatusTone('failed')).toBe('crit');
    expect(scanStatusTone('failed_upload')).toBe('crit');
  });
});

describe('S3 key helpers', () => {
  it('replaces every character the presigner cannot carry', () => {
    expect(sanitizeFilename('IMG 2692 (1).JPEG')).toBe('img_2692__1_.jpeg');
  });

  it('prefixes the key with the timestamp', () => {
    expect(buildScanFilekey('Scan Á.mp4', 1789014414230)).toBe('1789014414230_scan__.mp4');
  });

  it('takes the filekey out of a full storage path', () => {
    expect(extractFilekey('storage/u1/scan/b2/1789014414230_img_2692.jpeg')).toBe(
      '1789014414230_img_2692.jpeg',
    );
    expect(extractFilekey('no-separators.png')).toBe('no-separators.png');
  });
});
