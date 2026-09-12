/**
 * Scan tags, as the list renders them.
 *
 * Two of the five stored tags are suppressed rather than labelled. Measured
 * over 31,495 scans, `complete` and `incomplete` do not agree with the file
 * counts they sit beside:
 *
 *   2,651 scans are short on files and tagged `complete`
 *   2,428 scans have every file and are tagged `incomplete`
 *   5,841 scans are short on files and carry no tag at all
 *
 * A badge reading "incomplete" one word from a count reading 3/3 is not a
 * second opinion, it is a contradiction, and the count is the side with the
 * live value behind it. So the completeness tags never render; the file count
 * carries that fact on its own, in warn when it is short.
 *
 * Anything with no label here is dropped too. A raw database token shown to a
 * user is a leak, not a feature, and a new tag should be added deliberately.
 */
const SCAN_TAG_LABEL: Readonly<Record<string, string>> = {
  expert_scan_review: 'Expert review',
  resubmitted: 'Resubmitted',
  dicom: 'DICOM',
};

/** Stored, deliberately never rendered. See the note above. */
const SUPPRESSED_TAGS: ReadonlySet<string> = new Set(['complete', 'incomplete']);

export type DisplayTag = { id: string; label: string };

/**
 * The tags worth a chip, in the order the server sent them, de-duplicated.
 */
export function displayTags(tags: readonly string[] | null | undefined): DisplayTag[] {
  if (!tags?.length) return [];

  const seen = new Set<string>();
  const result: DisplayTag[] = [];

  for (const raw of tags) {
    const id = raw.trim().toLowerCase();
    if (!id || seen.has(id) || SUPPRESSED_TAGS.has(id)) continue;

    const label = SCAN_TAG_LABEL[id];
    if (!label) continue;

    seen.add(id);
    result.push({ id, label });
  }

  return result;
}

/** True when fewer files arrived than the scan declared. */
export function isMissingFiles(fileCount: number, fileTotal: number): boolean {
  return fileTotal > 0 && fileCount < fileTotal;
}

/** Hover text for a short file count, naming how many are missing. */
export function missingFilesTitle(fileCount: number, fileTotal: number): string | undefined {
  if (!isMissingFiles(fileCount, fileTotal)) return undefined;
  const missing = fileTotal - fileCount;
  return `${missing} of ${fileTotal} file${fileTotal === 1 ? '' : 's'} never finished uploading`;
}
