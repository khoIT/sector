import type { ScanFinding } from '@scanvault/api-client';

/**
 * What the learner declared, and whether they left anything unexamined.
 *
 * Confirming or contradicting the learner's own call is most of what a review
 * is, so the count of declared findings belongs on the row: 35% of queued
 * scans carry at least one, and a scan with none is a different kind of job.
 *
 * The gap chip is the sharper signal. 6% of queued scans contain at least one
 * item the learner marked as not examined — rare enough to mean something
 * when it appears, which is exactly what a warning tone is for.
 *
 * ## Why the gap test is an allow-list and not `/^not/i`
 *
 * The stored vocabulary has two families that both begin with "not" and mean
 * opposite things. These are real clinical findings on a normal study:
 *
 *   Not Widened    136
 *   Not Distended  106
 *   Not thick        1
 *
 * A prefix match flags all 243 as "the learner skipped this", which accuses
 * someone of omitting an examination they performed and recorded as normal.
 * That error is worse than missing a real gap, so an unrecognised value is
 * always read as a finding, never as a gap.
 *
 * The genuine gaps drift badly in case and spacing — `Not assessed` 772,
 * `Not Assessed` 126, `Not Measured` 80, `NotMeasured` 33, `not measured `
 * 18 — and a tail of rows where a measurement was typed through the middle of
 * the word (`Not Exa270.6mined`, `Not Examined31.78cm35w5d`). Stripping every
 * non-letter before the comparison rejoins most of those into `notexamined`;
 * the two dozen that stay mangled read as findings, which is the safe side.
 */

/** Lowercase letters only, so case, spacing and stray digits stop mattering. */
function lettersOf(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

/** Real findings that survive the normalisation looking like a gap. */
const FINDINGS_THAT_START_WITH_NOT: ReadonlySet<string> = new Set([
  'notwidened',
  'notdistended',
  'notthick',
]);

/** Stems of the values that genuinely mean "not examined". */
const GAP_STEMS: readonly string[] = [
  'notexam',
  'notassess',
  'notmeasur',
  'notdone',
  'notapplicable',
  'notrecorded',
];

/** True when this answer means the learner did not examine the item. */
export function isGapFinding(value: string | null | undefined): boolean {
  const letters = lettersOf(value ?? '');
  if (!letters) return false;
  if (FINDINGS_THAT_START_WITH_NOT.has(letters)) return false;
  if (letters === 'na') return true;
  return GAP_STEMS.some((stem) => letters.startsWith(stem));
}

export type FindingSummary = {
  /** How many findings the learner recorded. */
  count: number;
  /** How many of those say the item was not examined. */
  gaps: number;
};

export function summariseFindings(
  findings: readonly ScanFinding[] | null | undefined,
): FindingSummary {
  let gaps = 0;

  for (const finding of findings ?? []) {
    if (isGapFinding(finding.value)) gaps += 1;
  }

  return { count: findings?.length ?? 0, gaps };
}

/** `3 findings`, or null when the learner declared none. */
export function formatFindingCount(summary: FindingSummary): string | null {
  if (summary.count <= 0) return null;
  return `${summary.count} finding${summary.count === 1 ? '' : 's'}`;
}

/** Hover text naming how many items went unexamined. */
export function gapFindingTitle(summary: FindingSummary): string | undefined {
  if (summary.gaps <= 0) return undefined;
  return `${summary.gaps} item${summary.gaps === 1 ? '' : 's'} recorded as not examined`;
}
