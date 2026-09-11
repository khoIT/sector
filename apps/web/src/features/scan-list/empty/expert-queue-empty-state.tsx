import { Button, Card, CardContent } from '@scanvault/ui';
import { FolderClock, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';

import { SCAN_VAULT_PATH } from '../scan-list-views';

export type ExpertQueueEmptyStateProps = {
  reviewed: boolean;
  onRefresh: () => void;
};

/**
 * The diagnostic empty state for the expert queues.
 *
 * Expert scans are scoped by a DIFFERENT rule from the group queues, so this
 * state cannot reuse that copy. From scan.query.ts, buildExpertScansFilters:
 *
 *   - a scan is an "expert scan" only once a ScanReviewPurchase exists for it;
 *   - a reviewer holding read:scan:pending:expert (or …:reviewed:expert) sees
 *     ALL of them;
 *   - a reviewer holding only the :group variant sees only those belonging to
 *     groups where they are listed under the group's `scanReviewers`, further
 *     narrowed by the specialties and review types they were listed for.
 *
 * Both branches end in the same empty 200, so the state has to say which one
 * the caller is on.
 */
export function ExpertQueueEmptyState({ reviewed, onRefresh }: ExpertQueueEmptyStateProps) {
  const { can } = useAuth();

  const globalPermission = reviewed ? 'read:scan:reviewed:expert' : 'read:scan:pending:expert';
  const seesAllExpertScans = can(globalPermission);

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-ink-dim">
            <FolderClock className="h-6 w-6" aria-hidden />
          </span>

          <h2 className="text-[15px] font-semibold text-ink">
            {seesAllExpertScans
              ? reviewed
                ? 'No expert reviews completed yet'
                : 'No scans are waiting for expert review'
              : 'No expert scans reach you yet'}
          </h2>

          <p className="max-w-prose text-body text-ink-dim">
            {seesAllExpertScans ? (
              <>
                A scan only lands here once someone buys an expert review for it — a learner
                spending their own credits, or a group spending the group’s. Your role sees every
                expert scan in the organisation, so this queue is genuinely{' '}
                {reviewed ? 'without completed reviews' : 'clear'} right now.
              </>
            ) : (
              <>
                Expert scans reach you through the groups where you are listed as a{' '}
                <strong className="font-medium text-ink">scan reviewer</strong> — not through the
                groups you lead, and not through membership. You are not listed on any group, so
                nothing routes to you.
              </>
            )}
          </p>
        </div>

        {!seesAllExpertScans ? (
          <div className="mx-auto w-full max-w-lg rounded-token border border-line bg-surface-2 p-3">
            <p className="text-body text-ink-dim">
              Ask a GUSI administrator to add you to a group’s scan-reviewer list, and to set the
              specialties and review types you should receive. Both narrow the queue further, so a
              reviewer listed for cardiac only will never see a lung scan here.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Check again
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to={SCAN_VAULT_PATH.my}>Go to My Scans</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
