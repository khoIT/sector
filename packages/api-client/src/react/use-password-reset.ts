import { useMutation } from '@tanstack/react-query';

import {
  resetPassword,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
} from '../endpoints/password-reset';
import { mutationKeys } from '../query-keys';
import type {
  ForgotPasswordPayload,
  ForgotPasswordResult,
  ResetPasswordPayload,
  VerifyForgotPasswordOtpPayload,
  VerifyForgotPasswordOtpResult,
} from '../schemas/password-recovery';
import { useApiClient } from './api-provider';

/**
 * The recovery flow is three independent commands, not one multi-step
 * mutation: each step carries a different token forward (see
 * `schemas/password-recovery.ts`), and the web app persists that token in the
 * URL between steps so a reload does not lose the flow. None of the three
 * touches the query cache — there is no signed-in session yet for any of them
 * to invalidate.
 */

export function useSendPasswordResetOtpMutation() {
  const client = useApiClient();

  return useMutation<ForgotPasswordResult, Error, ForgotPasswordPayload>({
    mutationKey: mutationKeys.sendPasswordResetOtp(),
    mutationFn: (payload) => sendPasswordResetOtp(client, payload),
  });
}

export function useVerifyPasswordResetOtpMutation() {
  const client = useApiClient();

  return useMutation<VerifyForgotPasswordOtpResult, Error, VerifyForgotPasswordOtpPayload>({
    mutationKey: mutationKeys.verifyPasswordResetOtp(),
    mutationFn: (payload) => verifyPasswordResetOtp(client, payload),
  });
}

export function useResetPasswordMutation() {
  const client = useApiClient();

  return useMutation<void, Error, ResetPasswordPayload>({
    mutationKey: mutationKeys.resetPassword(),
    mutationFn: (payload) => resetPassword(client, payload),
  });
}
