import type { Group } from '@sector/api-client';

/**
 * Pure display shaping for one row of the groups index, kept out of the page
 * component so it can be unit tested without rendering anything.
 */

export type SeatsUsage = { used: number; total: number };

/**
 * `totalSeats` of 0 (the model's own default) or absent means "no cap
 * configured" — most groups in the production mirror are exactly this — so
 * there is nothing to show as a fraction. `null` here means "unlimited",
 * distinct from a real 0/0.
 */
export function seatsUsage(group: Pick<Group, 'totalSeats' | 'learnerCount'>): SeatsUsage | null {
  if (!group.totalSeats || group.totalSeats <= 0) return null;
  return { used: group.learnerCount ?? 0, total: group.totalSeats };
}

/** Whether this row has an expiry worth rendering at all. */
export function hasExpiry(group: Pick<Group, 'expirationDate'>): boolean {
  return Boolean(group.expirationDate);
}
