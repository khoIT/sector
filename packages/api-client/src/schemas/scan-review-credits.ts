import { z } from 'zod';

/**
 * Expert scan review: credit balances, the review request, and the Stripe
 * checkout hand-off.
 *
 * Two legacy defects are fixed here rather than reproduced:
 *   - `accountType` and `accountId` were typed optional; the server REQUIRES
 *     both and answers 400 without them.
 *   - `GET /api/scan-review/credits/groups` is not a registered route and 404s.
 *     The real one is `GET /api/scan-review/groups`, and it returns
 *     `{groupId, groupName, credits}` — not `{id, name, credits}`.
 */

export const scanReviewGroupCreditsSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  totalCredits: z.number(),
  currentCredits: z.number(),
  usedCredits: z.number(),
});

export type ScanReviewGroupCredits = z.infer<typeof scanReviewGroupCreditsSchema>;

/** GET /api/scan-review/user-credits — the user's own balance AND each group's. */
export const scanReviewCreditsSchema = z.object({
  userId: z.string(),
  userCredits: z.number(),
  totalUserCredits: z.number(),
  usedUserCredits: z.number(),
  groupCredits: z.number(),
  usedGroupCredits: z.number(),
  totalGroupCredits: z.number(),
  groups: z.array(scanReviewGroupCreditsSchema).default([]),
});

export type ScanReviewCredits = z.infer<typeof scanReviewCreditsSchema>;

/**
 * POST /api/scan-review/request-expert.
 *
 * `type: 'group'` additionally links the scan to that group, so it is the only
 * way to reach group-scoped reviewers after a scan has been created — at the
 * cost of one of the group's credits.
 */
export const requestExpertReviewPayloadSchema = z.object({
  scanId: z.string(),
  type: z.enum(['group', 'user']),
  typeId: z.string(),
});

export type RequestExpertReviewPayload = z.infer<typeof requestExpertReviewPayloadSchema>;

export const creditOptionSchema = z.object({
  credits: z.number().int().positive(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  name: z.string().min(1),
  description: z.string().optional(),
});

export type CreditOption = z.infer<typeof creditOptionSchema>;

export const purchaseCreditsPayloadSchema = z.object({
  /** REQUIRED server-side, despite the legacy client typing both optional. */
  accountType: z.enum(['user', 'group']),
  accountId: z.string(),
  option: creditOptionSchema,
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export type PurchaseCreditsPayload = z.infer<typeof purchaseCreditsPayloadSchema>;

export const purchaseCreditsResponseSchema = z.object({
  sessionId: z.string(),
  /** Stripe Checkout. Navigate the top-level window to it. */
  url: z.string(),
  credits: z.number(),
  amount: z.number(),
  currency: z.string(),
});

export type PurchaseCreditsResponse = z.infer<typeof purchaseCreditsResponseSchema>;

/**
 * The published credit bundles. They are hard-coded in the client on both the
 * legacy dashboard and here — the server takes `option` from the request body
 * and has no catalogue endpoint to read them from.
 */
export const CREDIT_OPTIONS: readonly CreditOption[] = [
  { credits: 10, amount: 150, currency: 'USD', name: '10 Scan Review Credits' },
  { credits: 25, amount: 250, currency: 'USD', name: '25 Scan Review Credits' },
  { credits: 50, amount: 650, currency: 'USD', name: '50 Scan Review Credits' },
  { credits: 100, amount: 1300, currency: 'USD', name: '100 Scan Review Credits' },
  { credits: 200, amount: 2400, currency: 'USD', name: '200 Scan Review Credits' },
  { credits: 500, amount: 5500, currency: 'USD', name: '500 Scan Review Credits' },
] as const;
