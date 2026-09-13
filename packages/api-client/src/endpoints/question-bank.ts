import { z } from 'zod';

import type { ApiClient } from '../client';
import {
  checkQuestionBankAnswersResultSchema,
  questionBankDetailSchema,
  questionBankProgressResultSchema,
  questionBankSummarySchema,
  saveQuestionBankProgressResultSchema,
  type CheckQuestionBankAnswersPayload,
  type QuestionBankDetail,
  type QuestionBankProgressResult,
  type QuestionBankResult,
  type QuestionBankSummary,
  type SaveQuestionBankProgressPayload,
  type SaveQuestionBankProgressResult,
} from '../schemas/question-bank';

/**
 * `/api/v2/question-banks*` — every route requires a signed-in caller
 * (`authUser`) and none of them checks a permission string, so any signed-in
 * account may list, open, save progress against and finish a question bank.
 */

const BASE_PATH = '/api/v2/question-banks';

/** GET / — published question banks, newest first, capped at 500 server-side. */
export async function getQuestionBanks(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<QuestionBankSummary[]> {
  return client.get(BASE_PATH, { schema: z.array(questionBankSummarySchema), signal });
}

/** GET /:slug — the bank with its questions and the caller's own progress. */
export async function getQuestionBankBySlug(
  client: ApiClient,
  slug: string,
  signal?: AbortSignal,
): Promise<QuestionBankDetail> {
  return client.get(`${BASE_PATH}/${slug}`, { schema: questionBankDetailSchema, signal });
}

/** GET /progress/:quizId — the caller's active (unfinished) attempt, if any. */
export async function getQuestionBankProgress(
  client: ApiClient,
  quizId: string,
  signal?: AbortSignal,
): Promise<QuestionBankProgressResult> {
  return client.get(`${BASE_PATH}/progress/${quizId}`, {
    schema: questionBankProgressResultSchema,
    signal,
  });
}

/** POST /save-progress — autosave, called on every answer selection. */
export async function saveQuestionBankProgress(
  client: ApiClient,
  payload: SaveQuestionBankProgressPayload,
  signal?: AbortSignal,
): Promise<SaveQuestionBankProgressResult> {
  return client.post(`${BASE_PATH}/save-progress`, {
    body: payload,
    schema: saveQuestionBankProgressResultSchema,
    signal,
  });
}

/**
 * POST /check-answers — grades the whole attempt server-side, once, at the
 * end. The response IS the score; nothing upstream of this call computes one.
 */
export async function checkQuestionBankAnswers(
  client: ApiClient,
  payload: CheckQuestionBankAnswersPayload,
  signal?: AbortSignal,
): Promise<QuestionBankResult> {
  return client.post(`${BASE_PATH}/check-answers`, {
    body: payload,
    schema: checkQuestionBankAnswersResultSchema,
    signal,
  });
}
