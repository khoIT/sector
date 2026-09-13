import type { Organization } from '@sector/api-client';

/** Below this, a study is unlikely to be a complete POCUS exam. */
export const MIN_RECOMMENDED_FILE_COUNT = 3;

/**
 * Whether to show the "most complete studies have at least three files" nudge.
 *
 * A user can belong to several organizations through different group
 * memberships, so the nudge is suppressed only when EVERY one of them has
 * opted out via `settings.hideMinFileCountWarning`. Any ambiguity — no
 * organizations loaded yet, an org with no settings block — errs toward still
 * showing it: a missed reminder costs a re-scan, a spurious one costs a glance.
 *
 * It is rendered INLINE, never as a modal. The legacy version was an
 * AlertDialog that interrupted the click on "Next", which taught people to
 * dismiss it without reading.
 */
export function shouldShowFileCountNudge(
  fileCount: number,
  organizations: Organization[] | undefined,
): boolean {
  if (fileCount === 0) return false;
  if (fileCount >= MIN_RECOMMENDED_FILE_COUNT) return false;
  if (!organizations || organizations.length === 0) return true;

  return !organizations.every((org) => org.settings?.hideMinFileCountWarning === true);
}
