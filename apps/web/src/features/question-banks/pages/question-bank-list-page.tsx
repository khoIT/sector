import { useQuestionBankList } from '@sector/api-client';
import { EmptyGrid, Skeleton } from '@sector/ui';
import { ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { QuestionBankCard } from '../components/question-bank-card';

/**
 * `/learn/question-banks` — every published bank as a card grid. The route
 * carries no filters or pagination server-side (the API caps it at 500 and
 * ignores query params entirely), so this page is the whole list, once.
 */
export function QuestionBankListPage() {
  const { t } = useTranslation();
  const query = useQuestionBankList();
  const banks = query.data ?? [];

  return (
    <section aria-labelledby="question-banks-heading">
      <h2 id="question-banks-heading" className="mb-3 text-[15px] font-semibold text-ink">
        {t('nav.questionBanks')}
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {query.isPending ? (
          Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-28 w-full" />)
        ) : query.isError ? (
          <EmptyGrid
            tone="crit"
            icon={<ListChecks className="h-5 w-5" aria-hidden />}
            title={t('questionBanks.loadErrorTitle')}
            description={query.error instanceof Error ? query.error.message : undefined}
            action={
              <button
                type="button"
                className="text-body font-medium text-accent-ink underline underline-offset-2"
                onClick={() => void query.refetch()}
              >
                {t('questionBanks.retry')}
              </button>
            }
          />
        ) : banks.length === 0 ? (
          <EmptyGrid
            icon={<ListChecks className="h-5 w-5" aria-hidden />}
            title={t('questionBanks.emptyTitle')}
            description={t('questionBanks.emptyDescription')}
          />
        ) : (
          banks.map((bank) => <QuestionBankCard key={bank.id} bank={bank} />)
        )}
      </div>
    </section>
  );
}
