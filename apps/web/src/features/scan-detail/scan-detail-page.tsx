import type { ScanListView } from '@sector/api-client';
import { isApiError, useScan } from '@sector/api-client';
import { Button, EmptyState, Skeleton } from '@sector/ui';
import { ArrowLeft, RotateCcw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';
import {
  EXPERT_REVIEWABLE_STATUSES,
  RESETTABLE_STATUSES,
} from '@/features/scan-list/rows/scan-row-actions';
import { useSetScanCompletionTag } from '@/features/scan-list/rows/use-scan-completion-tag';

import { QueueNav } from './components/queue-nav';
import { RequestExpertReviewDialog } from './components/request-expert-review-dialog';
import { ResetUploadDialog } from './components/reset-upload-dialog';
import { ScanContextPanel } from './components/scan-context-panel';
import { ScanMediaViewer } from './components/scan-media-viewer';
import { ScanNotesThread } from './components/scan-notes-thread';
import { ScanReviewPanel } from './components/scan-review-panel';
import { ScanReviewSummary } from './components/scan-review-summary';
import { ScanSharePanel } from './components/scan-share-panel';
import { isScanQueueState } from './queue-position';
import {
  safeReturnUrl,
  scanDetailPathFor,
  scanListPathFor,
  SCAN_VIEW_LABEL,
  SCAN_VIEW_PERMISSION,
} from './scan-detail-links';
import { clinicalNoteFor } from './scan-detail-format';

/** Queues where a reviewer submits feedback rather than reads it back. */
const REVIEW_QUEUES: ReadonlySet<ScanListView> = new Set<ScanListView>(['pending', 'expert']);

/** Where a submitted review lands, per source queue. */
const REVIEW_DESTINATION: Partial<Record<ScanListView, ScanListView>> = {
  pending: 'reviewed',
  expert: 'expert-reviewed',
};

/** Views where a reviewer, not the learner, is looking at the study. */
const REVIEWER_VIEWS = new Set<ScanListView>(['pending', 'reviewed', 'expert', 'expert-reviewed']);

export function ScanDetailPage({ view }: { view: ScanListView }) {
  const { t } = useTranslation();
  const { scanId } = useParams<{ scanId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, can } = useAuth();

  const scanQuery = useScan({ view, scanId });
  // Only a queue for THIS view drives the stepper. A state carried over from
  // another list would step the reviewer through ids this page cannot open.
  const queueState =
    isScanQueueState(location.state) && location.state.view === view ? location.state : null;
  const listPath = scanListPathFor(view);
  const returnUrl = safeReturnUrl(searchParams.get('returnUrl'), listPath);

  const scan = scanQuery.data;
  const isReviewQueue = REVIEW_QUEUES.has(view) && can('create:scan:review');
  const isOwner = view === 'my' && Boolean(user) && scan?.user.id === user?.id;
  const canEditCompletion = REVIEWER_VIEWS.has(view) && can('edit:scan');
  const canRequestExpertReview = Boolean(scan) && EXPERT_REVIEWABLE_STATUSES.has(scan!.status);
  // `edit:scan` is what PUT /api/scan/:id/reset-upload requires, so the
  // control is gated on the same thing the row menu gates it on.
  const canResetUpload = Boolean(scan) && can('edit:scan') && RESETTABLE_STATUSES.has(scan!.status);

  const completionTag = useSetScanCompletionTag();
  const [resetOpen, setResetOpen] = useState(false);
  const [expertReviewOpen, setExpertReviewOpen] = useState(false);

  function handleReviewed(reviewedScanId: string) {
    const destination = REVIEW_DESTINATION[view];

    // Only route to the reviewed queue when the reviewer can actually open it;
    // a role with create:scan:review but no view:scan:reviewed would otherwise
    // be bounced to the vault root the moment they submit.
    if (destination && can(SCAN_VIEW_PERMISSION[destination])) {
      navigate(scanDetailPathFor(destination, reviewedScanId, returnUrl));
      return;
    }
    navigate(returnUrl);
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={returnUrl}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t('scanDetail.page.back', { list: t(SCAN_VIEW_LABEL[view]) })}
            </Link>
          </Button>

          {/* Only when the reviewer arrived from a list. An emailed link has
              no queue behind it, and a stepper that cannot step is worse than
              none. */}
          {queueState && scanId ? (
            <QueueNav state={queueState} scanId={scanId} returnUrl={returnUrl} />
          ) : null}
        </div>

        {isOwner && scan ? (
          <div className="flex items-center gap-2">
            {canResetUpload ? (
              <Button variant="secondary" size="sm" onClick={() => setResetOpen(true)}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {t('actions.resetUpload')}
              </Button>
            ) : null}
            {/* Only on a submitted study. A credit spent on one that holds no
                files is spent, and the server's duplicate-purchase check then
                refuses the request forever. */}
            {canRequestExpertReview ? (
              <Button variant="secondary" size="sm" onClick={() => setExpertReviewOpen(true)}>
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> {t('actions.requestExpertReview')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isOwner && scan ? (
        <>
          <ResetUploadDialog
            scanId={scan.id}
            scanTitle={scan.title}
            open={resetOpen}
            onOpenChange={setResetOpen}
          />
          <RequestExpertReviewDialog
            scanId={scan.id}
            scanTitle={scan.title}
            tags={scan.tags}
            open={expertReviewOpen}
            onOpenChange={setExpertReviewOpen}
          />
        </>
      ) : null}

      {scanQuery.isPending ? (
        <DetailSkeleton />
      ) : scanQuery.isError ? (
        <EmptyState
          tone="crit"
          title={
            isApiError(scanQuery.error) && scanQuery.error.isNotFound
              ? t('scanDetail.page.notFound')
              : t('scanDetail.page.loadError')
          }
          description={
            isApiError(scanQuery.error)
              ? scanQuery.error.message
              : t('scanDetail.page.loadErrorDetail')
          }
          action={
            <Button variant="secondary" onClick={() => void scanQuery.refetch()}>
              {t('scanDetail.common.retry')}
            </Button>
          }
        />
      ) : !scan ? null : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_470px]">
          {/* Sticky on wide screens: the reviewer writes feedback in the right
              rail while scrolling, and the images have to stay on screen. */}
          <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <ScanMediaViewer files={scan.files} />
          </div>

          <div className="min-w-0 space-y-3">
            {isReviewQueue ? (
              <ScanReviewPanel
                // Remount on scan change so draft hydration and form state
                // never leak from one scan into the next.
                key={scan.id}
                scan={scan}
                isExpertScan={view === 'expert'}
                onSubmitted={handleReviewed}
              />
            ) : (
              <ScanReviewSummary review={scan.review} reviewedAt={scan.reviewedAt} />
            )}

            <ScanContextPanel
              scan={scan}
              clinicalNote={clinicalNoteFor(scan)}
              scanLogs={scan.scanLogs}
              logs={scan.logs}
              canEditCompletion={canEditCompletion}
              settingCompletion={completionTag.isPending}
              // `setCompletion` resolves on failure and reports here, so a
              // reviewer never sees a mark quietly do nothing.
              completionError={
                completionTag.error
                  ? isApiError(completionTag.error)
                    ? completionTag.error.message
                    : t('scanDetail.completionTagError')
                  : null
              }
              onSetCompletion={(next) => void completionTag.setCompletion(scan.id, scan.tags, next)}
            />

            <ScanNotesThread
              scanId={scan.id}
              canRead={can('read:scan:note')}
              canAdd={can('create:scan:note')}
            />

            {user ? <ScanSharePanel scanId={scan.id} currentUserId={user.id} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <Skeleton className="aspect-video w-full" />
      <div className="space-y-3">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
