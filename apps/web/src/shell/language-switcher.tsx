import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from '@scanvault/ui';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LOCALES, LOCALE_NAME, isLocale, type Locale } from '@/i18n/config';
import { changeLocale } from '@/i18n';
import { flagFor } from '@/i18n/language-store';

/**
 * The language control, matching legacy's shape: flag plus name above `md`,
 * flag alone below it.
 *
 * All seven are offered without a "not translated" marker, because all seven
 * are partly translated and to the same degree — the strings Scan Vault shares
 * with the legacy dashboard carry its translations, and Scan Vault's own
 * vocabulary falls back to English in every language including the ones a
 * marker would have flagged. A badge on six of seven would describe a
 * distinction that does not exist.
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current: Locale = isLocale(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-token border border-transparent px-2 py-1.5',
          'text-[13px] text-ink-dim outline-none transition-colors',
          'hover:border-line hover:bg-surface-2 hover:text-ink',
          'focus-visible:ring-2 focus-visible:ring-accent-ink',
          'data-[state=open]:border-line data-[state=open]:bg-surface-2',
        )}
        aria-label={`Language: ${LOCALE_NAME[current]}`}
      >
        <span aria-hidden className="text-[14px] leading-none">
          {flagFor(current)}
        </span>
        <span className="hidden md:inline">{LOCALE_NAME[current]}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {LOCALES.map((locale) => (
          <DropdownMenuItem key={locale} onSelect={() => void changeLocale(locale)}>
            <span aria-hidden className="text-[14px] leading-none">
              {flagFor(locale)}
            </span>
            {LOCALE_NAME[locale]}
            {locale === current ? (
              <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-accent-ink" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
