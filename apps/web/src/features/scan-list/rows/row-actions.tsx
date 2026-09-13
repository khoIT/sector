import { Badge, Button } from '@sector/ui';
import { Link } from 'react-router-dom';

/**
 * Row actions.
 *
 * Every action is a navigation, so it renders as a link styled as a button and
 * keeps middle-click, copy-link and back working. Anything that mutates a scan
 * lives on the scan's own page, not in a list row.
 */

export function OpenScanAction({ to, label = 'Open' }: { to: string; label?: string }) {
  return (
    <Button asChild variant="secondary" size="sm">
      <Link to={to}>{label}</Link>
    </Button>
  );
}

export type AssessActionProps = {
  to: string;
  /** False when the signed-in role lacks create:scan:review. */
  canReview: boolean;
  /** True when the row is the signed-in user's own scan. */
  isOwnScan: boolean;
};

/**
 * The review action on a queue row.
 *
 * A reviewer's own scans DO appear in the group queue — the server lists every
 * member of a group they lead, and a leader is a member of their own group —
 * but nobody may assess their own work. The row stays visible (hiding it would
 * make the count on the tab disagree with the rows on screen, and the scan is
 * still legitimately in the queue waiting for someone else) with the action
 * disabled and labelled, so the reason is on the row rather than discovered by
 * clicking.
 */
export function AssessAction({ to, canReview, isOwnScan }: AssessActionProps) {
  if (isOwnScan) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <Badge tone="neutral">Your scan</Badge>
        <Button
          size="sm"
          variant="secondary"
          disabled
          title="You cannot assess a scan you submitted yourself. Another reviewer in the group has to."
        >
          Assess
        </Button>
      </div>
    );
  }

  if (!canReview) {
    return <OpenScanAction to={to} label="View" />;
  }

  return (
    <Button asChild size="sm">
      <Link to={to}>Assess</Link>
    </Button>
  );
}
