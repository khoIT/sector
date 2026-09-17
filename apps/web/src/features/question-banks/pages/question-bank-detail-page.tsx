import {
  questionBankKeys,
  useApiClient,
  useQuestionBankDetail,
  useQuestionBankList,
  type QuestionBankDetail,
} from '@sector/api-client';
import { Badge, Button, EmptyState, ProgressMeter, RichText, Skeleton } from '@sector/ui';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { createBankAdapter } from '@/features/quiz/engine/adapters/bank';
import { canStartQuiz } from '@/features/quiz/engine/refuse-empty-quiz';

import { QuizResults } from '../components/quiz-results';
import { QuizRunner } from '../components/quiz-runner';
import { QUESTION_BANK_LIST_PATH } from '../question-bank-links';
import { toQuizQuestions } from '../to-quiz-questions';
import { useQuizRunner } from '../use-quiz-runner';

/**
 * `/learn/question-banks/:slug`.
 *
 * This top-level component only ever decides which of three states to show
 * (loading / not found / loaded) — it never calls `useQuizRunner` itself.
 * That split is load-bearing: `useReducer`'s init function runs exactly once,
 * on mount, so if the runner hook were called up here — above the pending
 * check — the FIRST render (before `bank` exists) would seed the reducer
 * with an empty question list forever, and every Start button would silently
 * hit the reducer's own zero-question refusal. `<QuestionBankRunnerSection>`
 * only ever mounts once `bank` is real, and remounts (via `key={bank.id}`)
 * if the slug changes to a different bank.
 */
export function QuestionBankDetailPage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const detail = useQuestionBankDetail(slug);
  // The detail route filters nothing by slug server-side — it will happily
  // return a well-formed response for a quiz that is not a question bank.
  // The list route DOES filter to isQbank, so cross-referencing it is the
  // only way to tell "not a question bank" apart from "failed to load".
  const list = useQuestionBankList();

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-9 w-32" />
      </div>
    );
  }

  const notAQuestionBank =
    list.isSuccess && Boolean(slug) && !list.data.some((bank) => bank.slug === slug);

  if (notAQuestionBank) {
    return (
      <EmptyState
        tone="crit"
        icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
        title={t('questionBanks.notAQuestionBank')}
        description={t('questionBanks.notAQuestionBankDescription')}
        action={
          <Button variant="secondary" asChild>
            <Link to={QUESTION_BANK_LIST_PATH}>{t('questionBanks.backToBanks')}</Link>
          </Button>
        }
      />
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <EmptyState
        tone="crit"
        icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
        title={t('questionBanks.detailLoadErrorTitle')}
        description={detail.error instanceof Error ? detail.error.message : undefined}
        action={
          <Button variant="secondary" onClick={() => void detail.refetch()}>
            {t('questionBanks.retry')}
          </Button>
        }
      />
    );
  }

  return <QuestionBankRunnerSection key={detail.data.id} bank={detail.data} slug={slug ?? ''} />;
}

function QuestionBankRunnerSection({ bank, slug }: { bank: QuestionBankDetail; slug: string }) {
  const { t } = useTranslation();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const questions = useMemo(() => toQuizQuestions(bank.questions), [bank.questions]);
  const adapter = useMemo(() => createBankAdapter(client, bank.id), [client, bank.id]);
  const runner = useQuizRunner(questions, adapter);

  const startable = canStartQuiz(questions.length);
  const hasActiveAttempt = Boolean(bank.progress && 'attemptId' in bank.progress);

  // The server's progress and per-question userAnswers go stale the instant
  // a new attempt starts; refetching is what lets "Continue" vs "Start a new
  // attempt" be right the next time this page loads.
  async function refreshBankProgress() {
    await queryClient.invalidateQueries({ queryKey: questionBankKeys.detail(slug) });
    await queryClient.invalidateQueries({ queryKey: questionBankKeys.progress(bank.id) });
  }

  async function takeAgain() {
    runner.restart();
    await refreshBankProgress();
  }

  async function backToList() {
    await refreshBankProgress();
    navigate(QUESTION_BANK_LIST_PATH);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        to={QUESTION_BANK_LIST_PATH}
        className="text-body text-accent-ink underline underline-offset-2"
      >
        {t('questionBanks.backToBanks')}
      </Link>

      {runner.resumeError ? (
        <Badge tone="crit" className="w-fit">
          {t('questionBanks.resumeError')}
        </Badge>
      ) : null}
      {runner.saveError ? (
        <Badge tone="warn" className="w-fit">
          {t('questionBanks.saveError')}
        </Badge>
      ) : null}

      {runner.state.phase === 'running' || runner.state.phase === 'finishing' ? (
        <QuizRunner
          state={runner.state}
          elapsedSeconds={runner.elapsedSeconds}
          onSelectSingle={runner.selectSingle}
          onToggleMultiple={runner.toggleMultiple}
          onNext={runner.next}
          onPrevious={runner.previous}
          onGoTo={runner.goTo}
          onFinish={runner.finish}
        />
      ) : runner.state.phase === 'finished' && runner.state.result ? (
        <QuizResults
          result={runner.state.result}
          questions={questions}
          onTakeAgain={() => void takeAgain()}
          onBackToList={() => void backToList()}
          backToListLabel={t('questionBanks.backToBanks')}
        />
      ) : runner.state.phase === 'failed' && runner.state.failureKind === 'submit-error' ? (
        <EmptyState
          tone="crit"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
          title={t('quiz.submitError')}
          description={runner.state.error ?? undefined}
          action={<Button onClick={() => void runner.finish()}>{t('quiz.retry')}</Button>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-[16px] font-semibold text-ink">{bank.title}</h2>
          {bank.content ? <RichText html={bank.content} /> : null}

          {!startable ? (
            <EmptyState
              tone="crit"
              icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
              title={t('questionBanks.noQuestionsRefusalTitle')}
              description={t('questionBanks.noQuestionsRefusalDescription')}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {hasActiveAttempt && bank.progress && 'attemptId' in bank.progress ? (
                <ProgressMeter
                  label={t('questionBanks.inProgress')}
                  value={bank.progress.answeredQuestions}
                  max={bank.progress.totalQuestions}
                />
              ) : (
                <p className="sv-num text-body text-ink-dim">
                  {t('questionBanks.questionCount', { count: questions.length })}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {hasActiveAttempt ? (
                  <>
                    <Button disabled={runner.isResuming} onClick={() => void runner.start()}>
                      {t('questionBanks.continueAttempt')}
                    </Button>
                    <Button variant="secondary" onClick={runner.startNew}>
                      {t('questionBanks.startNewAttempt')}
                    </Button>
                  </>
                ) : (
                  <Button disabled={runner.isResuming} onClick={() => void runner.start()}>
                    {t('questionBanks.start')}
                  </Button>
                )}
              </div>
              <p className="text-body text-ink-dim">
                {hasActiveAttempt ? t('questionBanks.resumeHint') : t('questionBanks.freshHint')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
