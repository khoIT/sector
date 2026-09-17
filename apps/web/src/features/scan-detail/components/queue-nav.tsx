import { useScanList } from '@sector/api-client';
import { Button } from '@sector/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { scanDetailPathFor } from '../scan-detail-links';
import { queueStateForPage, resolveQueuePosition, type ScanQueueState } from '../queue-position';
import { useQueueHotkeys } from './use-queue-hotkeys';

export type QueueNavProps = {
  state: ScanQueueState;
  scanId: string;
  returnUrl: string;
};

/**
 * Step the queue without going back to it.
 *
 * A reviewer working 20 unreviewed scans was making 40 navigations: open,
 * assess, back, open the next. This is the half that was missing, and `j`/`k`
 * make it a queue you can work rather than a list you keep returning to.
 *
 * Only rendered when the reviewer arrived FROM a list, so an emailed link
 * shows nothing — there is no queue behind it to step through.
 */
export function QueueNav({ state, scanId, returnUrl }: QueueNavProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const position = resolveQueuePosition(state, scanId);

  // Both hooks always run; `enabled` decides whether either is a request. Only
  // an edge of a page needs one, which is at most one row in twenty.
  const pagination = (pageIndex: number) => ({
    ...(state.filters as Record<string, unknown>),
    pagination: { pageIndex, pageSize: state.pageSize },
  });
  const previousPage = useScanList({
    view: state.view,
    filters: pagination(position.needsPrevPage ?? 0),
    enabled: position.needsPrevPage !== null,
    pollWhileProcessing: false,
  });
  const nextPage = useScanList({
    view: state.view,
    filters: pagination(position.needsNextPage ?? 0),
    enabled: position.needsNextPage !== null,
    pollWhileProcessing: false,
  });

  const previousId = position.prevId ?? previousPage.data?.items.at(-1)?.id ?? null;
  const nextId = position.nextId ?? nextPage.data?.items[0]?.id ?? null;

  const go = useCallback(
    (
      targetId: string | null,
      page: { items: Array<{ id: string }>; totalItems: number } | undefined,
      pageIndex: number | null,
    ) => {
      if (!targetId) return;

      const carried =
        pageIndex === null || !page
          ? { ...state, index: state.ids.indexOf(targetId) }
          : queueStateForPage(
              state,
              {
                ids: page.items.map((scan) => scan.id),
                pageIndex,
                totalItems: page.totalItems,
              },
              targetId,
            );

      navigate(scanDetailPathFor(state.view, targetId, returnUrl), { state: carried });
    },
    [navigate, returnUrl, state],
  );

  const goPrevious = useCallback(
    () => go(previousId, previousPage.data, position.needsPrevPage),
    [go, previousId, previousPage.data, position.needsPrevPage],
  );
  const goNext = useCallback(
    () => go(nextId, nextPage.data, position.needsNextPage),
    [go, nextId, nextPage.data, position.needsNextPage],
  );

  useQueueHotkeys({ onNext: goNext, onPrevious: goPrevious });

  return (
    <div className="flex items-center gap-1.5">
      {position.position > 0 ? (
        <span className="sv-num whitespace-nowrap text-[12px] text-ink-dim">
          {t('scanDetail.queueNav.position', {
            position: position.position,
            total: position.total,
          })}
        </span>
      ) : null}

      <Button
        variant="secondary"
        size="sm"
        disabled={!previousId}
        onClick={goPrevious}
        aria-label={t('scanDetail.queueNav.previous')}
        title={t('scanDetail.queueNav.hint')}
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">{t('scanDetail.queueNav.previous')}</span>
      </Button>

      <Button
        variant="secondary"
        size="sm"
        disabled={!nextId}
        onClick={goNext}
        aria-label={t('scanDetail.queueNav.next')}
        title={t('scanDetail.queueNav.hint')}
      >
        <span className="hidden sm:inline">{t('scanDetail.queueNav.next')}</span>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}
