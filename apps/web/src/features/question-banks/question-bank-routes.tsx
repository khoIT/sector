import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

import { pageMeasure } from '@/routes/route-measure';

/**
 * The two question-bank routes, replacing the UNBUILT_SURFACES placeholder
 * row that used to live at this path (see routes/unbuilt-surfaces.ts). No
 * permission gate: `/api/v2/question-banks*` guards on nothing but a session,
 * so every signed-in account may list, open and take a bank.
 *
 * Lazily loaded — reached from the rail, not the entry chunk.
 */
const QuestionBankListPage = lazy(() =>
  import('./pages/question-bank-list-page').then((m) => ({ default: m.QuestionBankListPage })),
);
const QuestionBankDetailPage = lazy(() =>
  import('./pages/question-bank-detail-page').then((m) => ({ default: m.QuestionBankDetailPage })),
);

export const questionBankRoutes: RouteObject[] = [
  {
    path: 'learn/question-banks',
    element: <QuestionBankListPage />,
    handle: pageMeasure('working'),
  },
  {
    path: 'learn/question-banks/:slug',
    element: <QuestionBankDetailPage />,
    handle: pageMeasure('reading'),
  },
];
