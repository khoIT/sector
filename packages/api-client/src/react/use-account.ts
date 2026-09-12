import { useMutation } from '@tanstack/react-query';

import {
  removeAccountPhoto,
  updateAccountPassword,
  updateAccountProfile,
  uploadAccountPhoto,
} from '../endpoints/account';
import type {
  AccountPhotoResult,
  AccountUser,
  UpdatePasswordPayload,
  UpdateProfilePayload,
} from '../schemas/account';
import { useApiClient } from './api-provider';

/**
 * The account mutations.
 *
 * None of them invalidates a query, because nothing here is cached as one: the
 * signed-in user lives in the auth session, not in React Query. Each caller
 * merges the result into that session itself — see `updateUser` on the auth
 * context — so the header updates without a refetch and without a reload.
 */

export function useUpdateProfileMutation() {
  const client = useApiClient();

  return useMutation<AccountUser, Error, UpdateProfilePayload>({
    mutationFn: (payload) => updateAccountProfile(client, payload),
  });
}

export function useUpdatePasswordMutation() {
  const client = useApiClient();

  return useMutation<void, Error, UpdatePasswordPayload>({
    mutationFn: (payload) => updateAccountPassword(client, payload),
  });
}

export function useUploadAccountPhotoMutation() {
  const client = useApiClient();

  return useMutation<AccountPhotoResult, Error, { file: File }>({
    mutationFn: ({ file }) => uploadAccountPhoto(client, file),
  });
}

export function useRemoveAccountPhotoMutation() {
  const client = useApiClient();

  return useMutation<void, Error, void>({
    mutationFn: () => removeAccountPhoto(client),
  });
}
