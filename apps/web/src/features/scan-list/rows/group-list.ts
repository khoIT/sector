import type { ScanGroupRef } from '@sector/api-client';

/**
 * Helpers for the group list a row can open.
 *
 * They are separate from the dialog because the interesting behaviour is the
 * ordering and the narrowing, and this app's web tests run in a node
 * environment with no DOM.
 */

/** Above this many names the list gets a filter input. Below it, the input is noise. */
export const GROUP_FILTER_THRESHOLD = 12;

/**
 * A group's display name.
 *
 * The server selects only `_id name` when it populates groups, so a group row
 * written without a name arrives with an empty one. Fall back to the id rather
 * than rendering a blank line the user cannot act on.
 */
export function groupDisplayName(group: ScanGroupRef): string {
  const name = group.name?.trim();
  return name || group.id;
}

/** Alphabetical by display name, locale-aware, leaving the input untouched. */
export function sortGroupsByName(groups: readonly ScanGroupRef[]): ScanGroupRef[] {
  return [...groups].sort((a, b) =>
    groupDisplayName(a).localeCompare(groupDisplayName(b), undefined, { sensitivity: 'base' }),
  );
}

/** Case-insensitive substring match on the display name. Blank keyword matches all. */
export function filterGroups(groups: readonly ScanGroupRef[], keyword: string): ScanGroupRef[] {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return [...groups];
  return groups.filter((group) => groupDisplayName(group).toLowerCase().includes(needle));
}

export function shouldOfferGroupFilter(count: number): boolean {
  return count > GROUP_FILTER_THRESHOLD;
}
