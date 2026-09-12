import { isPendingFilePlaceholder, mediaKindFor, type MediaFile } from '@scanvault/api-client';

/**
 * Clips versus stills, because `6/6 files` prices two very different jobs the
 * same.
 *
 * Six video loops is a fifteen-minute review; six still frames is closer to
 * ninety seconds. A reviewer picking the next item off a queue is choosing
 * how much time to commit, and the file ratio alone hides that entirely.
 *
 * Across the 108,577 stored files: 63,714 stills, 44,611 clips. Both halves
 * are large, so this line says something on essentially every row.
 *
 * DICOM is counted with neither — 188 files, 0.17%, and a scan carrying them
 * already gets a DICOM chip from its tags. Documents and unrecognised files
 * (64 in total) are not the study and are left out of the line rather than
 * padding it with a third term nobody is triaging on.
 */

export type MediaSummary = {
  clips: number;
  stills: number;
};

/**
 * Count the real media on a scan.
 *
 * Placeholder entries are excluded: they stand in for a file that never
 * landed, so counting one as a still would promise a frame that cannot be
 * opened. The short file count beside this line is where a missing file is
 * already reported.
 *
 * Kind comes from `mediaKindFor`, never from `filetype` directly — 18.7% of
 * file rows store a bare extension there, and they cluster in the oldest data,
 * which is the first thing a longest-waiting-first queue shows.
 */
export function summariseMedia(files: readonly MediaFile[] | null | undefined): MediaSummary {
  let clips = 0;
  let stills = 0;

  for (const file of files ?? []) {
    if (isPendingFilePlaceholder(file)) continue;

    const kind = mediaKindFor(file);
    if (kind === 'video') clips += 1;
    else if (kind === 'image') stills += 1;
  }

  return { clips, stills };
}

/**
 * The kinds present, in render order, each with its count.
 *
 * Returns data rather than a formatted string: the plural of "clip" is a
 * translation concern and belongs to i18next's plural rules, not to a helper
 * that only knows English. A kind with no files is omitted rather than
 * rendered as `0 clips`.
 */
export function mediaParts(summary: MediaSummary): Array<{ key: string; count: number }> {
  const parts: Array<{ key: string; count: number }> = [];
  if (summary.clips > 0) parts.push({ key: 'row.clip', count: summary.clips });
  if (summary.stills > 0) parts.push({ key: 'row.still', count: summary.stills });
  return parts;
}
