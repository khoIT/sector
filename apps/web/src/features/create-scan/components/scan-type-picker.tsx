import { useScanTypes, type ScanTypeSummary } from '@scanvault/api-client';
import { Button, EmptyState, Input, Skeleton, cn } from '@scanvault/ui';
import { Check, Loader2, Stethoscope } from 'lucide-react';
import { useMemo, useState } from 'react';

import { InlineNotice } from './inline-notice';

export type ScanTypePickerProps = {
  value: string | null;
  onChange: (scanType: ScanTypeSummary) => void;
  /**
   * A type whose definitions are being fetched before the switch can be
   * described. Only that tile shows a pending state; the rest of the grid
   * stays live, so a slow fetch never locks the picker.
   */
  pendingTypeId?: string | null;
};

/**
 * The scan-type picker. Choosing one is what unlocks the findings form and
 * the rest of the wizard, because the API needs `scanTypeId` at creation time
 * and offers no way to change it afterwards — picking the wrong one means
 * starting over, so it gets its own explicit step rather than a dropdown
 * buried next to the notes field.
 */
export function ScanTypePicker({ value, onChange, pendingTypeId }: ScanTypePickerProps) {
  const { data, isPending, isError, error, refetch } = useScanTypes();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const list = data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((type) => type.name.toLowerCase().includes(term));
  }, [data, search]);

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <InlineNotice
        tone="crit"
        title="Scan types could not be loaded"
        action={
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      >
        {error instanceof Error ? error.message : 'The request failed.'} Your files are still
        uploading and nothing has been lost.
      </InlineNotice>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Find a scan type"
        placeholder="AAA, Echo, Lung…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="max-w-xs"
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="h-5 w-5" aria-hidden />}
          title="No scan type matches that"
          description="Clear the search to see all scan types."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((type) => {
            const selected = type.id === value;
            const pending = type.id === pendingTypeId;
            return (
              <li key={type.id}>
                <button
                  type="button"
                  onClick={() => onChange(type)}
                  aria-pressed={selected}
                  aria-busy={pending || undefined}
                  disabled={pending}
                  className={cn(
                    'flex h-full w-full flex-col items-start gap-1 rounded-token border px-3 py-2.5 text-left transition-colors',
                    'outline-none focus-visible:ring-2 focus-visible:ring-accent-ink',
                    selected
                      ? 'border-accent-ink bg-accent-soft'
                      : 'border-line bg-surface hover:bg-surface-2',
                    pending && 'opacity-60',
                  )}
                >
                  <span className="flex w-full items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">
                      {type.name}
                    </span>
                    {pending ? (
                      <Loader2
                        className="h-4 w-4 shrink-0 animate-spin text-ink-dim"
                        aria-hidden
                      />
                    ) : selected ? (
                      <Check className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
                    ) : null}
                  </span>
                  {type.version ? (
                    <span className="sv-num text-[11px] text-ink-dim">v{type.version}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
