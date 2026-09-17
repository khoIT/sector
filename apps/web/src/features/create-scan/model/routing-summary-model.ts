import type { ExpertReviewChoice } from './draft-types';

/**
 * Where this study goes, in one line, from the draft state alone.
 *
 * Group routing is applied at creation and cannot be changed afterwards — the
 * API has no route that adds a group to an existing scan. At 2200 the panel
 * that decides it sits in a third column a long way from the submit button, so
 * the decision has to be restated where the learner is looking when they
 * commit. This is the shaping for that line, kept pure so the sentence can be
 * tested without rendering anything.
 *
 * Deliberately reads ONLY the draft. Resolving "your usual groups" into names
 * would need the groups query, and a summary that shows a spinner beside a
 * submit button is worse than one that names the default.
 */
export type RoutingSummary = {
  groupLabelKey: string;
  /** Only meaningful for the counted case; 0 otherwise. */
  groupCount: number;
  expertLabelKey: string;
  /** The credit pool the request will spend, for the expert line. */
  expertPool: string | null;
};

export type RoutingSummaryInput = {
  /** `null` means untouched: the default cohort applies. */
  groupIds: string[] | null;
  expertReview: ExpertReviewChoice | null;
};

export function routingSummary({ groupIds, expertReview }: RoutingSummaryInput): RoutingSummary {
  return {
    // Three distinct states, and the difference between the first two matters:
    // "not chosen" routes to the default cohort, "chosen as empty" routes to
    // nobody, and a learner who unticked every group needs to see that.
    groupLabelKey:
      groupIds === null
        ? 'createScan.routingSummary.groupsDefault'
        : groupIds.length === 0
          ? 'createScan.routingSummary.groupsNone'
          : 'createScan.routingSummary.groupsCount',
    groupCount: groupIds?.length ?? 0,
    expertLabelKey: expertReview
      ? 'createScan.routingSummary.expertRequested'
      : 'createScan.routingSummary.expertNone',
    // The pool as chosen. Whether it still HAS a credit at submit time is the
    // expert panel's question, not this line's — it states the request.
    expertPool: expertReview?.label ?? null,
  };
}
