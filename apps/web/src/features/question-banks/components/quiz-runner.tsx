import { Button, RadioCard, RichText, SegmentedProgress } from '@sector/ui';
import { useTranslation } from 'react-i18next';

import { allQuestionsAnswered, isQuestionAnswered } from '@/features/quiz/engine/answers';
import { isLastQuestion } from '@/features/quiz/engine/navigation';
import type { QuizState } from '@/features/quiz/engine/state';

import { formatElapsedTime } from '../format-elapsed-time';
import type { QuizRunnerController } from '../use-quiz-runner';

type QuizRunnerProps = {
  /** The caller renders this component only while phase is 'running' or
   *  'finishing' — QuizState is one flat shape rather than a discriminated
   *  union, so that check lives at the call site, not in this prop type. */
  state: QuizState;
  elapsedSeconds: number;
  onSelectSingle: QuizRunnerController['selectSingle'];
  onToggleMultiple: QuizRunnerController['toggleMultiple'];
  onNext: QuizRunnerController['next'];
  onPrevious: QuizRunnerController['previous'];
  onGoTo: QuizRunnerController['goTo'];
  onFinish: QuizRunnerController['finish'];
};

/**
 * The question-bank runner: one question at a time, single-choice as radio
 * cards, multiple-choice as checkboxes ("select all that apply"), autosaved
 * on every pick. Grading only ever happens once, in `onFinish` — nothing
 * here reveals correctness, because the bank adapter never learns it before
 * the server says so.
 */
export function QuizRunner({
  state,
  elapsedSeconds,
  onSelectSingle,
  onToggleMultiple,
  onNext,
  onPrevious,
  onGoTo,
  onFinish,
}: QuizRunnerProps) {
  const { t } = useTranslation();
  const question = state.questions[state.currentIndex];
  if (!question) return null;

  const selected = state.answers[question.id] ?? [];
  const answered = isQuestionAnswered(state.answers, question.id);
  const last = isLastQuestion(state.currentIndex, state.questions.length);
  const submitting = state.phase === 'finishing';
  const remaining = state.questions.length - Object.keys(state.answers).length;

  return (
    <div className="flex max-w-[42rem] flex-col gap-4">
      <div className="flex items-center justify-between gap-2 text-body text-ink-dim">
        <span>
          {t('quiz.questionOf', { current: state.currentIndex + 1, total: state.questions.length })}
        </span>
        <span className="sv-num">
          {t('quiz.elapsedTime')} · {formatElapsedTime(elapsedSeconds)}
        </span>
      </div>

      <SegmentedProgress
        label={t('quiz.questionOf', {
          current: state.currentIndex + 1,
          total: state.questions.length,
        })}
        total={state.questions.length}
        currentIndex={state.currentIndex}
        isDoneAt={(index) => isQuestionAnswered(state.answers, state.questions[index]?.id ?? '')}
        onJumpTo={onGoTo}
      />

      <div className="flex flex-col gap-1.5">
        <h3 className="text-[15px] font-semibold leading-snug text-ink">{question.title}</h3>
        {question.content ? <RichText html={question.content} /> : null}
        <span className="text-body text-ink-dim">
          {question.answerType === 'multiple' ? t('quiz.selectAllThatApply') : null}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {question.answers.map((option, index) => {
          const isSelected = selected.includes(option.id);
          return (
            <RadioCard
              key={option.id}
              role={question.answerType === 'multiple' ? 'checkbox' : 'radio'}
              selected={isSelected}
              optionKey={String.fromCharCode(65 + index)}
              disabled={submitting}
              onClick={() =>
                question.answerType === 'multiple'
                  ? onToggleMultiple(question.id, option.id)
                  : onSelectSingle(question.id, option.id)
              }
            >
              {option.allowHtml ? <RichText html={option.title} /> : option.title}
            </RadioCard>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={onPrevious}
          disabled={state.currentIndex === 0 || submitting}
        >
          {t('quiz.previous')}
        </Button>

        {last ? (
          <Button onClick={() => void onFinish()} disabled={!answered || submitting}>
            {submitting
              ? t('quiz.submitting')
              : allQuestionsAnswered(state.answers, state.questions)
                ? t('quiz.finish')
                : t('quiz.finishWithRemaining', { count: remaining })}
          </Button>
        ) : (
          <Button onClick={onNext} disabled={!answered || submitting}>
            {t('quiz.next')}
          </Button>
        )}
      </div>
    </div>
  );
}
