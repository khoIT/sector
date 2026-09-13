import { Button, EmptyState } from '@sector/ui';
import { Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { RetiredReason } from './legacy-route-map';

/**
 * What a bookmark to a surface that was not carried over lands on.
 *
 * The dashboard is being replaced, not copied, and several of its surfaces
 * were switched off on purpose — a storefront whose checkout did nothing, a
 * fellowship programme frozen against a backend that has moved on. Someone
 * arriving from an old link deserves to be told that in one sentence and
 * pointed at the nearest thing that does work, rather than a 404 that reads
 * as a broken deployment.
 *
 * The reason is a key, so the sentence is translated like everything else;
 * the evidence behind each retirement lives in the route map and the
 * decommission document, not on this page.
 */
export function RetiredSurfacePage({
  reason,
  alternative,
}: {
  reason: RetiredReason;
  alternative: string;
}) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="retired-surface-heading">
      <h2 id="retired-surface-heading" className="sr-only">
        {t('retired.title')}
      </h2>

      <EmptyState
        icon={<Archive className="h-5 w-5" aria-hidden />}
        title={t('retired.title')}
        description={t(`retired.reason.${reason}`)}
        action={
          <Button asChild>
            <Link to={alternative}>{t('retired.goInstead')}</Link>
          </Button>
        }
      />
    </section>
  );
}
