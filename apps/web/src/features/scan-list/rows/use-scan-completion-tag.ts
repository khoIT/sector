import { useAddScanTag, useRemoveScanTag } from '@sector/api-client';

import { completionTagMutation, type CompletionTag } from './scan-tags';

/**
 * Set a scan's completeness, enforcing client-side what the server does not.
 *
 * `scanService.addTag` writes with `$push`, not `$addToSet` or a replace, so
 * the two completeness tags are only ever mutually exclusive because this
 * hook makes them so: it removes the opposite tag (when present) before, or
 * without, adding the new one, and skips the add entirely when the scan
 * already carries it.
 */
export function useSetScanCompletionTag() {
  const addTag = useAddScanTag();
  const removeTag = useRemoveScanTag();

  async function setCompletion(
    scanId: string,
    currentTags: readonly string[],
    next: CompletionTag,
  ): Promise<void> {
    const mutation = completionTagMutation(currentTags, next);
    // The removal goes first: if only the add succeeds and this call is
    // retried, a second attempt sees the tag already there and correctly
    // no-ops it, rather than risking two additions landing before a removal.
    if (mutation.remove) await removeTag.mutateAsync({ scanId, tag: mutation.remove });
    if (mutation.add) await addTag.mutateAsync({ scanId, tag: mutation.add });
  }

  return {
    setCompletion,
    isPending: addTag.isPending || removeTag.isPending,
    error: addTag.error ?? removeTag.error,
  };
}
