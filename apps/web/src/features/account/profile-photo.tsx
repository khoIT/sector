import {
  isApiError,
  useRemoveAccountPhotoMutation,
  useUploadAccountPhotoMutation,
} from '@scanvault/api-client';
import { Button, cn } from '@scanvault/ui';
import { useRef, useState, type ChangeEvent } from 'react';

import { useAuth } from '@/auth/auth-context';
import { initialsFor, realPhotoUrl } from '@/shell/user-initials';

import { ACCEPTED_PHOTO_TYPES, photoRejectionReason } from './account-form-model';
import { FormNotice } from './account-form-parts';

/**
 * Upload or clear the account photo.
 *
 * Nobody has one: `photo` is empty on all 3,151 user documents, and the API
 * substitutes a shared grey silhouette so every account currently renders the
 * same anonymous icon. `realPhotoUrl` reads that placeholder as "no photo", so
 * this control shows initials until a real image is uploaded — and Remove puts
 * it back to initials rather than back to the silhouette.
 */
export function ProfilePhoto() {
  const auth = useAuth();
  const upload = useUploadAccountPhotoMutation();
  const remove = useRemoveAccountPhotoMutation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState<string | null>(null);

  const user = auth.user;
  if (!user) return null;

  const photo = realPhotoUrl(user.photo);
  const busy = upload.isPending || remove.isPending;

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear the input either way, so choosing the same file twice after a
    // failure still fires a change event.
    event.target.value = '';
    if (!file) return;

    const reason = photoRejectionReason(file);
    if (reason) {
      setRejected(reason);
      return;
    }
    setRejected(null);

    try {
      const result = await upload.mutateAsync({ file });
      auth.updateUser({ photo: result.url });
    } catch {
      // Rendered from upload.error below.
    }
  }

  async function clear() {
    setRejected(null);
    try {
      await remove.mutateAsync();
      // The server restores its default; store null so the app reads it as
      // "no photo" without waiting for the next session refresh.
      auth.updateUser({ photo: null });
    } catch {
      // Rendered from remove.error below.
    }
  }

  const error = rejected ?? failureMessage(upload.error, remove.error);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {photo ? (
          <img
            src={photo}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full border border-line object-cover"
          />
        ) : (
          <span
            aria-hidden
            className={cn(
              'flex h-16 w-16 shrink-0 items-center justify-center rounded-full',
              'border border-accent-ink/25 bg-accent-soft text-[18px] font-semibold text-accent-ink',
            )}
          >
            {initialsFor(user)}
          </span>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? 'Uploading…' : photo ? 'Replace photo' : 'Upload photo'}
          </Button>

          {photo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void clear()}
            >
              {remove.isPending ? 'Removing…' : 'Remove'}
            </Button>
          ) : null}

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_PHOTO_TYPES}
            className="sr-only"
            aria-label="Choose a profile photo"
            onChange={(event) => void choose(event)}
          />
        </div>
      </div>

      {error ? <FormNotice tone="crit">{error}</FormNotice> : null}
    </div>
  );
}

function failureMessage(uploadError: unknown, removeError: unknown): string | null {
  if (uploadError) {
    return isApiError(uploadError) ? uploadError.message : 'The photo could not be uploaded.';
  }
  if (removeError) {
    return isApiError(removeError) ? removeError.message : 'The photo could not be removed.';
  }
  return null;
}
