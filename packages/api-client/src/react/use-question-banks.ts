import { useQuery } from '@tanstack/react-query';

import {
  getQuestionBankBySlug,
  getQuestionBankProgress,
  getQuestionBanks,
} from '../endpoints/question-bank';
import { questionBankKeys } from '../query-keys';
import type {
  QuestionBankDetail,
  QuestionBankProgressResult,
  QuestionBankSummary,
} from '../schemas/question-bank';
import { useApiClient } from './api-provider';

/**
 * The two READ surfaces of a question bank. Saving progress and finishing an
 * attempt are not mutation hooks here — they are owned by the quiz engine's
 * adapter (apps/web/src/features/quiz/engine/adapters/bank.ts), which calls
 * the endpoint functions directly so the reducer, not react-query, is the one
 * place a running attempt's state lives.
 */

/** GET / — every published bank, for the index page's cards. */
export function useQuestionBankList() {
  const client = useApiClient();

  return useQuery<QuestionBankSummary[]>({
    queryKey: questionBankKeys.list(),
    queryFn: ({ signal }) => getQuestionBanks(client, signal),
  });
}

/** GET /:slug — one bank's questions, description and progress summary. */
export function useQuestionBankDetail(slug: string | undefined, enabled = true) {
  const client = useApiClient();

  return useQuery<QuestionBankDetail>({
    queryKey: questionBankKeys.detail(slug ?? ''),
    queryFn: ({ signal }) => getQuestionBankBySlug(client, slug as string, signal),
    enabled: enabled && Boolean(slug),
  });
}

/**
 * GET /progress/:quizId — whether the caller has an unfinished attempt on
 * one bank. There is no batch/list version of this route, so the index
 * page's "in progress" pill costs one request per card; the mirror's 18
 * published banks (and the server's own 500-item cap on the list) keep that
 * bounded rather than something a real catalogue would need pagination for.
 */
export function useQuestionBankProgress(quizId: string | undefined, enabled = true) {
  const client = useApiClient();

  return useQuery<QuestionBankProgressResult>({
    queryKey: questionBankKeys.progress(quizId ?? ''),
    queryFn: ({ signal }) => getQuestionBankProgress(client, quizId as string, signal),
    enabled: enabled && Boolean(quizId),
  });
}
