import { useEffect, useState } from 'react';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, cn } from '@scanvault/ui';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

import { PAGE_SIZE_OPTIONS } from './list-url-state';

export type DataTablePaginationProps = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  /** Dim the controls while the next page is in flight, without unmounting them. */
  busy?: boolean;
};

/**
 * Server-side pagination. `totalItems` comes from the API rather than being
 * derived from the rows on screen, so the range reads "21-40 of 2,002" even
 * though only 20 rows were fetched.
 *
 * A group queue routinely runs past 100 pages, so next/previous alone is not
 * navigation: the page number is an editable field and the outer buttons jump
 * to the first and last page. Longest-waiting-first means the last page holds
 * the newest submissions, which is a place reviewers genuinely want to reach.
 */
export function DataTablePagination({
  page,
  limit,
  totalItems,
  totalPages,
  onPageChange,
  onLimitChange,
  busy = false,
}: DataTablePaginationProps) {
  const firstRow = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const lastRow = Math.min(page * limit, totalItems);
  const lastPage = Math.max(1, totalPages);

  // Typing "12" in a 101-page list passes through "1", so the field holds its
  // own text and only reports a clamped page when the edit is finished.
  const [draft, setDraft] = useState(String(page));
  useEffect(() => setDraft(String(page)), [page]);

  const commitDraft = () => {
    const parsed = Number(draft);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setDraft(String(page));
      return;
    }
    const next = Math.min(parsed, lastPage);
    setDraft(String(next));
    if (next !== page) onPageChange(next);
  };

  const atStart = busy || page <= 1;
  const atEnd = busy || page >= lastPage;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
      <p className="text-body text-ink-dim">
        <span className="sv-num">{firstRow.toLocaleString()}</span>
        {'–'}
        <span className="sv-num">{lastRow.toLocaleString()}</span> of{' '}
        <span className="sv-num">{totalItems.toLocaleString()}</span>
      </p>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-body text-ink-dim">
          <span className="hidden sm:inline">Rows</span>
          <Select value={String(limit)} onValueChange={(value) => onLimitChange(Number(value))}>
            <SelectTrigger className="h-7 w-[4.5rem]" aria-label="Rows per page" />
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex items-center gap-1.5 text-body text-ink-dim">
          <span>Page</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label={`Page number, 1 to ${lastPage}`}
            value={draft}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ''))}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitDraft();
              }
              if (event.key === 'Escape') setDraft(String(page));
            }}
            className={cn(
              'sv-num h-7 rounded-token border border-line bg-surface px-1.5 text-center text-body text-ink',
              'outline-none transition-colors focus-visible:border-accent-ink focus-visible:ring-2 focus-visible:ring-accent-ink',
              'disabled:cursor-not-allowed disabled:opacity-60',
              // Widen with the page count so "101" is not clipped.
              lastPage >= 1000 ? 'w-14' : lastPage >= 100 ? 'w-11' : 'w-9',
            )}
          />
          <span>
            of <span className="sv-num">{lastPage.toLocaleString()}</span>
          </span>
        </label>

        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            aria-label="First page"
            disabled={atStart}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeft className="h-4 w-4" aria-hidden />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            aria-label="Previous page"
            disabled={atStart}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            aria-label="Next page"
            disabled={atEnd}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            aria-label="Last page"
            disabled={atEnd}
            onClick={() => onPageChange(lastPage)}
          >
            <ChevronsRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
