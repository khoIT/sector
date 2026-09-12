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

function term(count: number, singular: string, plural: string): string | null {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * `4 clips · 2 stills`, or null when there is nothing to say.
 *
 * A kind with no files is omitted rather than printed as `0 clips`, so a
 * stills-only scan reads as short as it is.
 */
export function formatMediaSummary(summary: MediaSummary): string | null {
  const parts = [term(summary.clips, 'clip', 'clips'), term(summary.stills, 'still', 'stills')];
  const present = parts.filter((part): part is string => part !== null);
  return present.length > 0 ? present.join(' · ') : null;
}
