import { isApiError } from '@sector/api-client';

/**
 * The message to show a user for a failure, whatever the failure turned out
 * to be.
 *
 * The pattern this replaces was `isApiError(e) ? e.message : undefined`, which
 * renders NOTHING for anything the transport did not produce — a `TypeError`
 * from a helper that ran after a successful request, a DOMException from
 * `atob` on a malformed payload, a bug in our own success path. Those are
 * exactly the failures worth showing, and they were the ones being swallowed:
 * the button stopped spinning and the screen said the operation had not
 * happened only by saying nothing at all.
 *
 * `fallback` is a translated string, so the caller keeps control of the copy.
 * An ApiError's own `message` is the server's, which is already user-facing on
 * these routes (seat limits, "already a member", 403s).
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  return fallback;
}
