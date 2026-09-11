import { z, type ZodTypeAny } from 'zod';

/**
 * Every GUSI API route answers with the same envelope:
 *   { statusCode, status, message, data }
 *
 * The envelope itself is read with plain property checks rather than a Zod
 * schema, because two of its fields are unreliable and a strict schema would
 * reject responses that are perfectly valid:
 *
 *  1. `status` is sometimes MISSING on a successful response. The group-leader
 *     branch of POST /api/scan-review/request answers `{ message }` with no
 *     `status` key, while the non-leader branch sends one. The legacy client
 *     derived success from `status === 'success'` and therefore reported a
 *     successful review request as a failure. This client trusts the HTTP
 *     status instead and treats `status: 'error'` as the ONLY failure signal.
 *
 *  2. `data` is sometimes MISSING entirely (DELETE /api/shared-scans/:id sends
 *     no data key at all), so it resolves to undefined.
 *
 * The `data` payload IS parsed, by the per-endpoint schema passed to the client.
 */

/** Returns true only for an explicit `status: 'error'`. Missing means success. */
export function isErrorEnvelope(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'status' in body &&
    (body as { status?: unknown }).status === 'error'
  );
}

/** Best-effort message extraction for error reporting. */
export function envelopeMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const message = (body as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

export function envelopeDetails(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) return undefined;
  return (body as { details?: unknown }).details;
}

/** Unwraps `data`, or undefined when the envelope omitted it. */
export function envelopeData(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) return undefined;
  return (body as { data?: unknown }).data;
}

/**
 * The shape of every paginated list route.
 *
 * Deliberately has NO `sortBy`, `sortOrder` or `expired`. The legacy `Items<T>`
 * type declared those three as present — `sortBy` and `sortOrder` even as
 * required — and the scan and shared-scan servers send none of them, so they
 * were always undefined at runtime.
 */
export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export function paginatedSchema<TItem extends ZodTypeAny>(item: TItem) {
  return z.object({
    items: z.array(item),
    page: z.number(),
    limit: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  });
}
