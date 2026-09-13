import type { UserGroup } from '@sector/api-client';

/**
 * Which groups a new scan should be routed to by default.
 *
 * The legacy selector pre-ticked EVERY group the learner belonged to
 * (components/scan-group-selector.tsx:88), so a student in a course cohort, a
 * department group and a university-wide parent group broadcast every scan to
 * all three. Reviewers in the wide groups then waded through scans that were
 * never meant for them, and the learner had to notice and untick.
 *
 * The default here is the LEAF groups only: those that are not the parent of
 * another group the user is in. A leaf is the most specific cohort the user
 * belongs to, which is the audience a scan is normally for. The wider groups
 * stay one tick away — this changes the default, not the choice.
 */
export function defaultGroupCohort(groups: UserGroup[] | undefined): string[] {
  if (!groups || groups.length === 0) return [];

  const parentIds = new Set(
    groups.map((group) => group.parent?.id).filter((id): id is string => Boolean(id)),
  );

  const leaves = groups.filter((group) => !parentIds.has(group.id));

  // Every group being someone else's parent means a cycle or bad data; fall
  // back to everything rather than routing the scan nowhere.
  return (leaves.length > 0 ? leaves : groups).map((group) => group.id);
}

/** Human explanation of why a group is or is not pre-selected. */
export function isWiderThanCohort(group: UserGroup, groups: UserGroup[] | undefined): boolean {
  if (!groups) return false;
  return groups.some((other) => other.parent?.id === group.id);
}
