import { Button, EmptyState } from '@scanvault/ui';
import { ListRestart } from 'lucide-react';

export type PagePastEndStateProps = {
  page: number;
  totalItems: number;
  onGoToFirstPage: () => void;
};

/**
 * Shown when the list has rows, but not on THIS page.
 *
 * Reached by a bookmark, by Back, or by returning through a `returnUrl` after
 * the last row on the last page was dealt with. Without it the page falls to
 * whichever diagnostic empty state the surface uses, and a group leader
 * standing on page 12 of a 2,000-scan queue is told they lead no groups —
 * beside a toolbar that says 2,000 scans, with the pagination hidden because
 * there were no rows to hang it on.
 */
export function PagePastEndState({ page, totalItems, onGoToFirstPage }: PagePastEndStateProps) {
  return (
    <EmptyState
      icon={<ListRestart className="h-5 w-5" aria-hidden />}
      title={`Nothing on page ${page}`}
      description={`This list holds ${totalItems.toLocaleString()} ${
        totalItems === 1 ? 'scan' : 'scans'
      }, but none of them are on this page. It is probably a link to a page that has since emptied.`}
      action={
        <Button variant="secondary" size="sm" onClick={onGoToFirstPage}>
          Back to the first page
        </Button>
      }
    />
  );
}
