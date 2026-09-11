import { describe, expect, it } from 'vitest';

import { extensionOf, mediaFormatLabel, mediaKindFor } from './media-kind';

/**
 * Cases taken from the real `filetype` values in `gusi_dev`: 88,260 rows carry
 * a MIME type and 20,317 carry a bare extension, so both spellings of every
 * common format have to resolve to the same kind.
 */
describe('mediaKindFor', () => {
  it.each([
    ['image/jpeg', 'image'],
    ['image/png', 'image'],
    ['image/bmp', 'image'],
    ['image/heic', 'image'],
    ['jpg', 'image'],
    ['jpeg', 'image'],
    ['png', 'image'],
    ['bmp', 'image'],
    ['gif', 'image'],
  ] as const)('reads %s as an image', (filetype, kind) => {
    expect(mediaKindFor({ filetype, filename: 'clip' })).toBe(kind);
  });

  it.each([
    ['video/mp4', 'video'],
    ['video/quicktime', 'video'],
    ['video/x-ms-wmv', 'video'],
    ['video/x-flv', 'video'],
    ['mp4', 'video'],
    ['mov', 'video'],
    ['avi', 'video'],
    ['webm', 'video'],
  ] as const)('reads %s as a video', (filetype, kind) => {
    expect(mediaKindFor({ filetype, filename: 'clip' })).toBe(kind);
  });

  it('reads DICOM from the MIME type or the filename', () => {
    expect(mediaKindFor({ filetype: 'application/dicom', filename: 'a' })).toBe('dicom');
    expect(mediaKindFor({ filetype: '', filename: 'study.dcm' })).toBe('dicom');
  });

  it.each(['application/pdf', 'application/zip', 'text/csv', 'text/plain', 'pdf'])(
    'reads %s as a document',
    (filetype) => {
      expect(mediaKindFor({ filetype, filename: 'a' })).toBe('document');
    },
  );

  it('falls back to the filename when filetype is missing or meaningless', () => {
    expect(mediaKindFor({ filetype: '', filename: 'DVT-29FEB-2704.jpg' })).toBe('image');
    expect(mediaKindFor({ filetype: null, filename: 'scan.MP4' })).toBe('video');
    expect(mediaKindFor({ filetype: 'application/octet-stream', filename: 'x.png' })).toBe('image');
  });

  it('gives up rather than guessing', () => {
    expect(mediaKindFor({ filetype: '', filename: 'no-extension' })).toBe('unknown');
    expect(mediaKindFor({ filetype: 'weird', filename: '' })).toBe('unknown');
  });
});

describe('mediaFormatLabel', () => {
  it.each([
    [{ filetype: 'image/jpeg', filename: 'a.jpg' }, 'JPEG'],
    [{ filetype: 'jpg', filename: 'a.jpg' }, 'JPG'],
    [{ filetype: 'video/x-ms-wmv', filename: 'a.wmv' }, 'MS-WMV'],
    [{ filetype: '', filename: 'a.PNG' }, 'PNG'],
  ])('labels %j as %s', (file, label) => {
    expect(mediaFormatLabel(file)).toBe(label);
  });

  it('does not print an unreadable office MIME subtype', () => {
    const file = {
      filetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'results.xlsx',
    };
    expect(mediaFormatLabel(file)).toBe('XLSX');
  });
});

describe('extensionOf', () => {
  it('handles paths, missing dots and trailing dots', () => {
    expect(extensionOf('storage/user/scan/1700_test.png')).toBe('png');
    expect(extensionOf('no-extension')).toBe('');
    expect(extensionOf('trailing.')).toBe('');
    expect(extensionOf('.hidden')).toBe('');
  });
});
