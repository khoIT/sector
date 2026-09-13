import { useMutation } from '@tanstack/react-query';

import { confirmGroupInvitation } from '../endpoints/invitation';
import { mutationKeys } from '../query-keys';
import type {
  ConfirmGroupInvitationPayload,
  ConfirmGroupInvitationResult,
} from '../schemas/invitation';
import { useApiClient } from './api-provider';

export function useConfirmGroupInvitationMutation() {
  const client = useApiClient();

  return useMutation<ConfirmGroupInvitationResult, Error, ConfirmGroupInvitationPayload>({
    mutationKey: mutationKeys.confirmGroupInvitation(),
    mutationFn: (payload) => confirmGroupInvitation(client, payload),
  });
}
