import type { ScanTypeSummary, UserGroup } from '@sector/api-client';

/**
 * The two setup controls, as options and as the words on their triggers.
 *
 * Kept out of the component so the labelling rules can be tested: the web
 * package's vitest runs in a node environment over `src/**\/*.test.ts` and
 * cannot render a `.tsx`.
 */

export type SetupOption = {
  value: string;
  label: string;
  description?: string;
};

/** Scan types, newest-version detail on the second line. */
export function scanTypeOptions(types: readonly ScanTypeSummary[] | undefined): SetupOption[] {
  return (types ?? []).map((type) => ({
    value: type.id,
    label: type.name,
    ...(type.version ? { description: `v${type.version}` } : {}),
  }));
}

/**
 * Groups, with the parent named underneath.
 *
 * The parent is what distinguishes two identically-named cohorts in different
 * programmes, and it is also the thing a learner searches by when they know the
 * institution but not the class.
 */
export function groupOptions(groups: readonly UserGroup[] | undefined): SetupOption[] {
  return (groups ?? []).map((group) => ({
    value: group.id,
    label: group.name,
    ...(group.parent ? { description: `in ${group.parent.name}` } : {}),
  }));
}

/**
 * What the groups trigger reads.
 *
 * One group shows its name rather than "1 group": the name is the thing the
 * learner is checking, and a count of one tells them nothing they did not
 * already know. Past that, the count is shorter than any truncation of three
 * names would be.
 */
export function groupTriggerLabel(
  selected: readonly string[],
  groups: readonly UserGroup[] | undefined,
): string {
  if (selected.length === 0) return 'No groups';
  if (selected.length === 1) {
    const only = groups?.find((group) => group.id === selected[0]);
    return only?.name ?? '1 group';
  }
  return `${selected.length} groups`;
}

/** Add or remove one group, preserving the order the rest were in. */
export function toggleGroup(selected: readonly string[], groupId: string): string[] {
  return selected.includes(groupId)
    ? selected.filter((id) => id !== groupId)
    : [...selected, groupId];
}
