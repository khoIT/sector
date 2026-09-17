import { Button, RadioCard, RichText, SegmentedProgress } from '@sector/ui';
import { useTranslation } from 'react-i18next';

import { answeredCount, isQuestionAnswered } from '@/features/quiz/engine/answers';
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
  const currentAnswered = isQuestionAnswered(state.answers, question.id);
  const last = isLastQuestion(state.currentIndex, state.questions.length);
  const submitting = state.phase === 'finishing';
  const answered = answeredCount(state.answers, state.questions);
  // Finish is available once ANY question has an answer, not only when this
  // one does — a learner who deselects the last question they are looking at
  // must still be able to submit the ones they already answered; the count
  // in `quiz.finishWithRemaining` already tells them what is left unanswered.
  const canFinish = answered > 0;

  return (
    <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-4">
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
        segmentLabel={(index) => t('quiz.jumpToQuestion', { number: index + 1 })}
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

      <div role="radiogroup" aria-label={question.title} className="flex flex-col gap-2">
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
              {/* Always through RichText, not gated on `allowHtml` — that
                  flag is author-set and unreliable (real answer bodies carry
                  markup with it left false); sanitising plain text is a
                  no-op, so there is no cost to always doing it. */}
              <RichText html={option.title} className="inline" />
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
          <Button onClick={() => void onFinish()} disabled={!canFinish || submitting}>
            {submitting
              ? t('quiz.submitting')
              : answered === state.questions.length
                ? t('quiz.finish')
                : t('quiz.finishWithRemaining', { count: state.questions.length - answered })}
          </Button>
        ) : (
          <Button onClick={onNext} disabled={!currentAnswered || submitting}>
            {t('quiz.next')}
          </Button>
        )}
      </div>
    </div>
  );
}
