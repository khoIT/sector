import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

import { SectorMark } from '@/shell/sector-mark';
import { ThemeSwitcher } from '@/shell/theme-switcher';

/**
 * The chrome every unauthenticated page shares: the wordmark, the tagline,
 * and the theme switcher. Pulled out of `LoginPage` rather than copied five
 * times across the recovery, invitation and reset pages — the same visitor
 * can land on any of these from an email link, and the pages should look like
 * one product, not four rebuilds of the same header.
 */
export function AuthPageLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <SectorMark size={36} />
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-ink">Sector</h1>
            <p className="mt-0.5 text-body text-ink-dim">{t('auth.tagline')}</p>
          </div>
        </div>

        {children}

        <div className="mt-4 flex justify-center">
          <ThemeSwitcher />
        </div>
      </div>
    </main>
  );
}
