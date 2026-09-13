import { questionBankKeys, useApiClient, useQuestionBankDetail } from '@sector/api-client';
import { Button, EmptyState, ProgressMeter, RichText, Skeleton } from '@sector/ui';
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

/** `/learn/question-banks/:slug`. */
export function QuestionBankDetailPage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const query = useQuestionBankDetail(slug);
  const client = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const bank = query.data;
  const questions = useMemo(() => toQuizQuestions(bank?.questions ?? []), [bank?.questions]);
  const adapter = useMemo(() => createBankAdapter(client, bank?.id ?? ''), [client, bank?.id]);
  const runner = useQuizRunner(questions, adapter);

  if (query.isPending) {
    return (
      <div className="flex max-w-[42rem] flex-col gap-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-9 w-32" />
      </div>
    );
  }

  if (query.isError || !bank) {
    return (
      <EmptyState
        tone="crit"
        icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
        title={t('questionBanks.detailLoadErrorTitle')}
        description={query.error instanceof Error ? query.error.message : undefined}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {t('questionBanks.retry')}
          </Button>
        }
      />
    );
  }

  const startable = canStartQuiz(questions.length);
  const hasActiveAttempt = Boolean(bank.progress && 'attemptId' in bank.progress);

  // The server's progress and per-question userAnswers go stale the instant
  // a new attempt starts; refetching is what lets "Continue" vs "Start a new
  // attempt" be right the next time this page loads.
  async function refreshBankProgress() {
    await queryClient.invalidateQueries({ queryKey: questionBankKeys.detail(slug ?? '') });
    if (bank) await queryClient.invalidateQueries({ queryKey: questionBankKeys.progress(bank.id) });
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
        <div className="flex max-w-[42rem] flex-col gap-4">
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
