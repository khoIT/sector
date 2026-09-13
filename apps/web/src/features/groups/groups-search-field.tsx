import { Input } from '@sector/ui';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type GroupsSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

/**
 * The one search box both group-administration surfaces need. Small enough,
 * and used in exactly two places, that a shared component beats copying the
 * toolbar's search markup a second time — see `data-table-toolbar.tsx` for
 * the pattern this mirrors.
 */
export function GroupsSearchField({ value, onChange, placeholder }: GroupsSearchFieldProps) {
  const { t } = useTranslation();

  return (
    <div className="relative min-w-[14rem] flex-1">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-dim"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-8 pr-8"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('toolbar.clearSearch')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-ink-dim outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
