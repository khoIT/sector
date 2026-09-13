import { runQuizAdapterContractTests } from './adapter-contract';
import { createBankAdapter } from './bank';
import { createStatefulFakeBankServer } from './stateful-fake-bank-server';

/** The bank adapter's run of the shared contract suite (see ./adapter-contract.ts).
 *  A future course adapter's own test file imports `runQuizAdapterContractTests`
 *  the same way, against its own harness. */
runQuizAdapterContractTests('question bank', () => {
  const result = {
    attemptId: 'attempt-1',
    quizId: 'quiz-1',
    slug: 'bank',
    title: 'Bank',
    score: 1,
    totalScore: 1,
    percentageScore: 100,
    passed: true,
    timeSpent: 12,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:12.000Z',
    questions: [],
    totalAttempts: 1,
    bestScore: 100,
    averageScore: 100,
  };

  const { client } = createStatefulFakeBankServer('quiz-1', result);
  return { adapter: createBankAdapter(client, 'quiz-1'), result };
});
