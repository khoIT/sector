import { useQuery } from '@tanstack/react-query';

import { getQuestionBankBySlug, getQuestionBanks } from '../endpoints/question-bank';
import { questionBankKeys } from '../query-keys';
import type { QuestionBankDetail, QuestionBankSummary } from '../schemas/question-bank';
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
