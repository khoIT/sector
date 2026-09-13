import { useQuestionBankProgress, type QuestionBankSummary } from '@sector/api-client';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@sector/ui';
import { ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { canStartQuiz } from '@/features/quiz/engine/refuse-empty-quiz';

import { questionBankDetailPath } from '../question-bank-links';

type QuestionBankCardProps = {
  bank: QuestionBankSummary;
};

/**
 * One bank on the index grid: icon, title, question count, and — the one
 * thing the list route itself cannot tell us — whether the caller has an
 * unfinished attempt, fetched per card from GET /progress/:quizId (there is
 * no batch route; see use-question-banks.ts). A bank with zero questions
 * renders as a plain, non-interactive card: no Start button exists because
 * there is nothing to start.
 */
export function QuestionBankCard({ bank }: QuestionBankCardProps) {
  const { t } = useTranslation();
  const questionCount = bank.questions.length;
  const startable = canStartQuiz(questionCount);

  // Skipped entirely for an unavailable bank — there is no attempt to have.
  const progress = useQuestionBankProgress(bank.id, startable);
  const inProgress = Boolean(progress.data?.attemptInfo);

  const body = (
    <Card className={startable ? 'transition-colors hover:bg-surface-2' : undefined}>
      <CardHeader className="items-start">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-token bg-surface-2 text-ink-dim">
            <ListChecks className="h-4 w-4" aria-hidden />
          </span>
          <CardTitle className="truncate">{bank.title}</CardTitle>
        </div>
        {startable ? (
          inProgress ? (
            <Badge tone="warn">{t('questionBanks.inProgress')}</Badge>
          ) : null
        ) : (
          <Badge tone="crit">{t('questionBanks.unavailable')}</Badge>
        )}
      </CardHeader>
      <CardContent>
        <p className="sv-num text-body text-ink-dim">
          {startable
            ? t('questionBanks.questionCount', { count: questionCount })
            : t('questionBanks.unavailableDescription')}
        </p>
      </CardContent>
    </Card>
  );

  if (!startable) return body;

  return (
    <Link to={questionBankDetailPath(bank.slug)} aria-label={bank.title} className="block">
      {body}
    </Link>
  );
}
