import { isApiError } from '@sector/api-client';
import { Button, EmptyState } from '@sector/ui';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type CardErrorProps = {
  error: unknown;
  onRetry: () => void;
};

/**
 * What a home card shows when its query failed.
 *
 * Every card on this screen used to render a failure as its empty state: a
 * 403, a 500 and a schema mismatch all came out as "no scans yet for this
 * group". A screen that looks healthy while it is broken is worse than one
 * that admits it, and it is how three of the bugs on this surface survived
 * every gate.
 *
 * Same shape as the gallery's category bar (`features/gallery/category-bar.tsx`)
 * — crit tone, the server's own message, a retry — because a second error
 * style would just be a second thing to keep consistent.
 */
export function CardError({ error, onRetry }: CardErrorProps) {
  const { t } = useTranslation();

  return (
    <EmptyState
      tone="crit"
      icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
      title={t('home.error.title')}
      description={isApiError(error) ? error.message : undefined}
      action={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('home.error.retry')}
        </Button>
      }
    />
  );
}
