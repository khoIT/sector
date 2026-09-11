import { useScanUserGroups } from '@scanvault/api-client';
import { Button, Card, CardContent, cn } from '@scanvault/ui';
import { Inbox, RefreshCw, Users2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';

import { SCAN_VAULT_PATH } from '../scan-list-views';

export type GroupQueueEmptyStateProps = {
  /** Unreviewed vs reviewed changes the wording, not the underlying rule. */
  reviewed: boolean;
  onRefresh: () => void;
};

/**
 * The diagnostic empty state for the group queues.
 *
 * "No results." is the wrong answer here, because the overwhelmingly common
 * cause is not "no scans exist" — it is that the caller leads no group, and
 * nothing in the UI says the queue is leader-scoped at all.
 *
 * The server rule (scan.query.ts, buildGroupScansFilters): it looks up every
 * group where the caller is the LEADER, expands those to their members, and
 * lists those members' scans. If the leader set is empty it returns an empty
 * page with HTTP 200 — indistinguishable, from the wire, from a queue that is
 * genuinely clear. Verified with reviewer-solo@scanvault.test, which holds
 * view:scan:pending, leads nothing, and gets 200 with totalItems: 0.
 *
 * So this state states the rule, shows the user's own group membership as
 * evidence, and names the fix.
 */
export function GroupQueueEmptyState({ reviewed, onRefresh }: GroupQueueEmptyStateProps) {
  const { can } = useAuth();
  const groups = useScanUserGroups();

  // 'full-access' takes a reviewer straight to the ALL_SCANS scope, where the
  // leader rule never applies and an empty queue really does mean empty.
  const seesEverything = can('full-access');
  const memberships = groups.data ?? [];
  const leadsNothingForSure = !groups.isPending && memberships.length === 0;

  const noun = reviewed ? 'reviewed scans' : 'scans waiting for review';

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-ink-dim">
            <Inbox className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="text-[15px] font-semibold text-ink">
            {seesEverything ? `No ${noun} right now` : `No ${noun} reach you yet`}
          </h2>
          <p className="max-w-prose text-body text-ink-dim">
            {seesEverything
              ? `Your role sees every scan in the organisation, so this really is empty — nothing is ${reviewed ? 'been reviewed' : 'waiting'} at the moment.`
              : 'This queue is built from the groups you LEAD. The server finds every group where you are the leader, expands them to their members, and lists those members’ scans. Leading no group means this list stays empty no matter how many scans exist.'}
          </p>
        </div>

        {!seesEverything ? (
          <div
            className={cn(
              'mx-auto w-full max-w-lg rounded-token border border-line bg-surface-2 p-3',
            )}
          >
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-dim">
              <Users2 className="h-3.5 w-3.5" aria-hidden />
              Your groups
            </p>

            {groups.isPending ? (
              <p className="mt-1.5 text-body text-ink-dim">Checking…</p>
            ) : memberships.length === 0 ? (
              <p className="mt-1.5 text-body text-ink">
                You are not a member of any group, so you lead none.
              </p>
            ) : (
              <>
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {memberships.map((group) => (
                    <li key={group.id} className="text-body text-ink">
                      {group.name}
                      {group.parent ? (
                        <span className="text-ink-dim"> · {group.parent.name}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-body text-ink-dim">
                  You belong to {memberships.length === 1 ? 'this group' : 'these groups'}, but
                  membership is not enough — the queue only fills from groups where you are the
                  leader.
                </p>
              </>
            )}

            <p className="mt-2 text-body text-ink-dim">
              {leadsNothingForSure
                ? 'Ask a GUSI administrator to add you to a group as its leader. The queue fills as soon as a member of that group submits a scan.'
                : 'If you should be leading one of these, ask a GUSI administrator to change your role in it to leader.'}
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
