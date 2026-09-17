import { Send, Sparkles, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { routingSummary, type RoutingSummaryInput } from '../model/routing-summary-model';

export type RoutingSummaryProps = {
  state: RoutingSummaryInput;
};

/**
 * Where this study goes, restated beside the submit button.
 *
 * Group routing is decided in the setup step and cannot be changed after the
 * study is created; at 2200 that step is a long way up the page. This repeats
 * the two decisions — which groups, and whether an expert was asked — so
 * committing does not require remembering.
 */
export function RoutingSummary({ state }: RoutingSummaryProps) {
  const { t } = useTranslation();
  const summary = routingSummary(state);

  return (
    <div className="flex flex-col gap-2 rounded-token border border-line bg-surface p-3">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
        <Send className="h-3 w-3" aria-hidden />
        {t('createScan.routingSummary.title')}
      </span>

      <p className="flex items-start gap-1.5 text-body text-ink-dim">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{t(summary.groupLabelKey, { count: summary.groupCount })}</span>
      </p>

      <p className="flex items-start gap-1.5 text-body text-ink-dim">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{t(summary.expertLabelKey, { pool: summary.expertPool })}</span>
      </p>
    </div>
  );
}
