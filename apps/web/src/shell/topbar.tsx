import { Button } from '@sector/ui';
import { Menu, Search, X } from 'lucide-react';

import { useTranslation } from 'react-i18next';

import { AccountMenu } from './account-menu';
import { LanguageSwitcher } from './language-switcher';

export const SHELL_HEADING_ID = 'shell-page-title';
export const MOBILE_NAV_ID = 'shell-mobile-nav';

export type TopbarProps = {
  /** Current surface, used as the page heading. */
  title: string;
  navOpen: boolean;
  onToggleNav: () => void;
  onOpenCommandMenu: () => void;
};

/**
 * The topbar owns the page <h1>.
 *
 * That is a shell contract, not a style preference: the heading names the
 * surface the router resolved, so it stays correct without every feature page
 * remembering to render one, and it is the label the <main> landmark points
 * at. Feature pages start their own headings at <h2>.
 */
export function Topbar({ title, navOpen, onToggleNav, onOpenCommandMenu }: TopbarProps) {
  const { t } = useTranslation();

  return (
    <header className="flex items-center gap-2 px-3 py-3 lg:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 lg:hidden"
        onClick={onToggleNav}
        aria-expanded={navOpen}
        aria-controls={MOBILE_NAV_ID}
      >
        {navOpen ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
        <span className="sr-only">
          {navOpen ? t('nav.closeNavigation') : t('nav.openNavigation')}
        </span>
      </Button>

      <h1
        id={SHELL_HEADING_ID}
        className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-ink"
      >
        {title}
      </h1>

      {/* The theme control lives in the account menu: it is a set-once
          preference and the identity it sits beside is the thing the header
          was missing.

          The account menu itself is only here below lg, where the sidebar —
          and so the rail copy of this menu — is display-none. Above lg it
          would be the same identity on screen twice. */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {/* The hint is shown, not just documented: a shortcut nobody is told
            about is a shortcut nobody uses. Icon only below `sm`, where the
            chord does not exist anyway. */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenCommandMenu}
          className="gap-1.5 text-ink-dim"
          aria-label={t('command.open')}
        >
          <Search className="h-4 w-4" aria-hidden />
          <kbd className="hidden rounded-[4px] border border-line px-1 text-[10px] font-medium lg:inline">
            {'\u2318K'}
          </kbd>
        </Button>

        <LanguageSwitcher />
        <div className="lg:hidden">
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
