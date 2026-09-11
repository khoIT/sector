import { Button, EmptyState } from '@scanvault/ui';
import { SearchX } from 'lucide-react';

export type NarrowedEmptyStateProps = {
  keyword: string;
  filterCount: number;
  onClear: () => void;
};

/**
 * Shown when the list is empty because the USER narrowed it.
 *
 * Kept separate from the diagnostic states on purpose: telling a reviewer that
 * they lead no groups when in fact they typed a typo into the search box would
 * send them to an administrator for nothing. The two causes get two answers.
 */
export function NarrowedEmptyState({ keyword, filterCount, onClear }: NarrowedEmptyStateProps) {
  const parts: string[] = [];
  if (keyword.trim()) parts.push(`the search “${keyword.trim()}”`);
  if (filterCount > 0) parts.push(`${filterCount} ${filterCount === 1 ? 'filter' : 'filters'}`);

  return (
    <EmptyState
      icon={<SearchX className="h-5 w-5" aria-hidden />}
      title="Nothing matches what you asked for"
      description={`No scans match ${parts.join(' and ')}. The data is there — this view is just narrowed.`}
      action={
        <Button variant="secondary" size="sm" onClick={onClear}>
          Clear search and filters
        </Button>
      }
    />
  );
}
