/**
 * The narrow slice of draft storage that sign-out needs.
 *
 * A separate module so `auth-context.tsx` does not import the create-scan
 * feature's internals to do one cleanup — the auth layer should not be able to
 * reach the upload pump, and a barrel that let it would invite exactly that.
 */
export { clearDraftFiles } from './draft-blob-store';
export { currentDraftId } from './draft-storage';
