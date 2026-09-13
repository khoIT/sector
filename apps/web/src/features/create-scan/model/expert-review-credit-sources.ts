import type { ScanReviewCredits } from '@sector/api-client';

/**
 * Every pool a signed-in user could spend an expert-review credit from.
 *
 * Extracted from `ExpertReviewPanel` so the panel can be reused wherever a
 * credit choice is made — inside the create-scan wizard and, now, requesting
 * a review on a scan that already exists — without a second copy of this
 * shape or the total/used figures the audit found missing.
 */
export type ExpertReviewCreditSource = {
  key: string;
  accountType: 'user' | 'group';
  accountId: string;
  label: string;
  /** Spendable right now. */
  credits: number;
  used: number;
  total: number;
};

export type ExpertReviewChoiceRef = { accountType: 'user' | 'group'; accountId: string };

/** Personal balance first, then every group's, in the order the API sent them. */
export function expertReviewCreditSources(
  userId: string,
  userName: string,
  credits: ScanReviewCredits,
): ExpertReviewCreditSource[] {
  return [
    {
      key: `user:${userId}`,
      accountType: 'user',
      accountId: userId,
      label: `${userName} (your balance)`,
      credits: credits.userCredits,
      used: credits.usedUserCredits,
      total: credits.totalUserCredits,
    },
    ...credits.groups.map((group) => ({
      key: `group:${group.groupId}`,
      accountType: 'group' as const,
      accountId: group.groupId,
      label: group.groupName,
      credits: group.currentCredits,
      used: group.usedCredits,
      total: group.totalCredits,
    })),
  ];
}

/** The source a choice refers to, or undefined once it no longer exists. */
export function findCreditSource(
  sources: readonly ExpertReviewCreditSource[],
  value: ExpertReviewChoiceRef | null,
): ExpertReviewCreditSource | undefined {
  if (!value) return undefined;
  return sources.find(
    (source) => source.accountType === value.accountType && source.accountId === value.accountId,
  );
}

/**
 * True when a chosen pool has drained to zero since it was picked.
 *
 * Picking an empty pool is already blocked at selection time; this is for
 * the pool that was NOT empty when chosen and became so on a later refetch —
 * another request against the same group credits, for instance. Without
 * this, the panel keeps promising a review no pool can actually pay for.
 */
export function isChoiceDrained(
  sources: readonly ExpertReviewCreditSource[],
  value: ExpertReviewChoiceRef | null,
): boolean {
  const source = findCreditSource(sources, value);
  return source !== undefined && source.credits <= 0;
}
