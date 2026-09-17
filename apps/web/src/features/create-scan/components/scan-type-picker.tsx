import { useScanTypes, type ScanTypeSummary } from '@sector/api-client';
import { Button, EmptyState, Input, Skeleton, cn } from '@sector/ui';
import { Check, Loader2, Stethoscope } from 'lucide-react';
import { useMemo, useState } from 'react';

import { InlineNotice } from './inline-notice';
import { useTranslation } from 'react-i18next';

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
 * The scan type's own icon — 50x50 flat art in object storage, reached through
 * a short-lived presigned URL the list endpoint mints per request.
 *
 * It falls back to the generic stethoscope when a type carries no image or the
 * URL has already expired, so a tile never collapses into a broken-image glyph
 * and every tile in the grid keeps the same height. Decorative: the type's name
 * is right beside it, so screen readers should not hear it twice.
 */
function ScanTypeThumb({ src }: { src: string | null | undefined }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-token bg-surface-2"
        aria-hidden
      >
        <Stethoscope className="h-4 w-4 text-ink-dim" />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-9 w-9 shrink-0 rounded-token bg-surface-2 object-contain p-1"
    />
  );
}

/**
 * The scan-type picker. Choosing one is what unlocks the findings form and
 * the rest of the wizard, because the API needs `scanTypeId` at creation time
 * and offers no way to change it afterwards — picking the wrong one means
 * starting over, so it gets its own explicit step rather than a dropdown
 * buried next to the notes field.
 */
export function ScanTypePicker({ value, onChange, pendingTypeId }: ScanTypePickerProps) {
  const { t } = useTranslation();
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
        title={t('createScan.typePicker.loadError')}
        action={
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            {t('createScan.typePicker.retry')}
          </Button>
        }
      >
        {error instanceof Error ? error.message : t('createScan.typePicker.requestFailed')}{' '}
        {t('createScan.typePicker.loadErrorDetail')}
      </InlineNotice>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        label={t('createScan.typePicker.findLabel')}
        placeholder={t('createScan.typePicker.findPlaceholder')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="max-w-xs"
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="h-5 w-5" aria-hidden />}
          title={t('createScan.typePicker.noMatchTitle')}
          description={t('createScan.typePicker.noMatchDetail')}
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
                  <span className="flex w-full items-center gap-2">
                    <ScanTypeThumb src={type.imageUrl} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-1.5">
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
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
