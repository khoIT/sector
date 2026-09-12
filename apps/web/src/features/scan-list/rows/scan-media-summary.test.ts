import type { MediaFile } from '@scanvault/api-client';
import { describe, expect, it } from 'vitest';

import { formatMediaSummary, summariseMedia } from './scan-media-summary';

function file(partial: Partial<MediaFile> & { id: string }): MediaFile {
  return {
    filename: 'clip.mp4',
    filesize: 1,
    filetype: 'video/mp4',
    filepath: 'storage/clip.mp4',
    status: 'completed',
    url: null,
    urlThumbnail: null,
    url360: null,
    url480: null,
    url720: null,
    ...partial,
  };
}

describe('summariseMedia', () => {
  it('splits video from image', () => {
    expect(
      summariseMedia([
        file({ id: '1', filetype: 'video/mp4', filename: 'a.mp4' }),
        file({ id: '2', filetype: 'image/png', filename: 'b.png' }),
        file({ id: '3', filetype: 'image/jpeg', filename: 'c.jpg' }),
      ]),
    ).toEqual({ clips: 1, stills: 2 });
  });

  it('reads the bare extensions the oldest rows store in filetype', () => {
    // 20,317 file rows store `mp4`/`jpg` rather than a MIME type, and they are
    // the oldest data — the first thing a longest-waiting-first queue shows.
    expect(
      summariseMedia([
        file({ id: '1', filetype: 'mp4', filename: 'a' }),
        file({ id: '2', filetype: 'jpg', filename: 'b' }),
        file({ id: '3', filetype: 'mov', filename: 'c' }),
      ]),
    ).toEqual({ clips: 2, stills: 1 });
  });

  it('falls back to the filename when filetype says nothing useful', () => {
    expect(
      summariseMedia([
        file({ id: '1', filetype: 'application/octet-stream', filename: 'scan.MP4' }),
        file({ id: '2', filetype: '', filename: 'DVT-29FEB-2704.jpg' }),
      ]),
    ).toEqual({ clips: 1, stills: 1 });
  });

  it('counts neither dicom nor documents, which are not the study', () => {
    expect(
      summariseMedia([
        file({ id: '1', filetype: 'application/dicom', filename: 'study.dcm' }),
        file({ id: '2', filetype: 'application/pdf', filename: 'report.pdf' }),
        file({ id: '3', filetype: '', filename: 'no-extension' }),
      ]),
    ).toEqual({ clips: 0, stills: 0 });
  });

  it('skips placeholders for files that never landed', () => {
    expect(
      summariseMedia([
        file({ id: 'pending-1', filetype: 'video/mp4', filename: 'a.mp4' }),
        file({ id: '2', filetype: 'video/mp4', filename: 'b.mp4' }),
      ]),
    ).toEqual({ clips: 1, stills: 0 });
  });

  it('handles an absent file list', () => {
    expect(summariseMedia(null)).toEqual({ clips: 0, stills: 0 });
    expect(summariseMedia(undefined)).toEqual({ clips: 0, stills: 0 });
    expect(summariseMedia([])).toEqual({ clips: 0, stills: 0 });
  });
});

describe('formatMediaSummary', () => {
  it('joins the kinds that are present', () => {
    expect(formatMediaSummary({ clips: 4, stills: 2 })).toBe('4 clips · 2 stills');
  });

  it('omits a kind with no files rather than printing a zero', () => {
    expect(formatMediaSummary({ clips: 0, stills: 3 })).toBe('3 stills');
    expect(formatMediaSummary({ clips: 2, stills: 0 })).toBe('2 clips');
  });

  it('is singular at one', () => {
    expect(formatMediaSummary({ clips: 1, stills: 1 })).toBe('1 clip · 1 still');
  });

  it('says nothing when there is no media to describe', () => {
    expect(formatMediaSummary({ clips: 0, stills: 0 })).toBeNull();
  });
});
