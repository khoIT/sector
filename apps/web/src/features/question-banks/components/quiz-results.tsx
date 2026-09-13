import type { QuestionBankResultQuestion, QuestionBankResult } from '@sector/api-client';
import { Badge, Button, Card, CardContent, RichText, Ring, Stat } from '@sector/ui';
import { useTranslation } from 'react-i18next';

import type { QuizQuestion } from '@/features/quiz/engine/types';

import { formatElapsedTime } from '../format-elapsed-time';

type QuizResultsProps = {
  result: QuestionBankResult;
  questions: readonly QuizQuestion[];
  onTakeAgain: () => void;
  onBackToList: () => void;
};

/**
 * The finished screen: the server's score verbatim (never recomputed here),
 * and a per-question review that renders BOTH remediation messages —
 * `correctMessage` for a right answer and, as a genuine bug fix over the
 * legacy client, `incorrectMessage` for a wrong one. The legacy app rendered
 * only the first, unconditionally; clinician authors write the second and no
 * learner ever saw it.
 */
export function QuizResults({ result, questions, onTakeAgain, onBackToList }: QuizResultsProps) {
  const { t } = useTranslation();
  const byId = new Map(questions.map((question) => [question.id, question] as const));

  return (
    <div className="flex max-w-[42rem] flex-col gap-5">
      <h3 className="text-[15px] font-semibold text-ink">{t('quiz.resultsTitle')}</h3>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 pt-4">
          <Ring percentage={result.percentageScore} size={72}>
            {Math.round(result.percentageScore)}%
          </Ring>
          <Stat
            label={t('quiz.scoreLabel')}
            value={`${result.score} / ${result.totalScore}`}
            hint={
              <Badge tone={result.passed ? 'ok' : 'crit'}>
                {result.passed ? t('quiz.passed') : t('quiz.failed')}
              </Badge>
            }
          />
          <Stat label={t('quiz.timeLabel')} value={formatElapsedTime(result.timeSpent)} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h4 className="text-body font-semibold text-ink-dim">{t('quiz.reviewTitle')}</h4>
        {result.questions.map((entry, index) => (
          <ResultQuestionCard
            key={entry.questionId}
            index={index}
            entry={entry}
            question={byId.get(entry.questionId)}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBackToList}>
          {t('questionBanks.backToBanks')}
        </Button>
        <Button onClick={onTakeAgain}>{t('quiz.takeAgain')}</Button>
      </div>
    </div>
  );
}

function ResultQuestionCard({
  index,
  entry,
  question,
}: {
  index: number;
  entry: QuestionBankResultQuestion;
  question: QuizQuestion | undefined;
}) {
  const { t } = useTranslation();
  const isMultiple = entry.answerType === 'multiple';
  const message = entry.isCorrect ? question?.correctMessage : question?.incorrectMessage;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-body font-medium text-ink">
            {index + 1}. {entry.title}
          </span>
          <Badge tone={entry.isCorrect ? 'ok' : 'crit'}>
            {entry.isCorrect ? t('quiz.correct') : t('quiz.incorrect')}
          </Badge>
        </div>

        <div className="text-body text-ink-dim">
          <span className="font-medium text-ink">
            {isMultiple ? t('quiz.yourAnswers') : t('quiz.yourAnswer')}:
          </span>{' '}
          {entry.selectedAnswers.length > 0
            ? entry.selectedAnswers.map((answer) => answer.title).join(', ')
            : '—'}
        </div>

        {!entry.isCorrect ? (
          <div className="text-body text-ink-dim">
            <span className="font-medium text-ink">
              {isMultiple ? t('quiz.correctAnswers') : t('quiz.correctAnswer')}:
            </span>{' '}
            {entry.correctAnswers.map((answer) => answer.title).join(', ')}
          </div>
        ) : null}

        {message ? <RichText html={message} className="text-body" /> : null}
      </CardContent>
    </Card>
  );
}
