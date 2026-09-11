import { Button } from '@scanvault/ui';
import { Menu, X } from 'lucide-react';

import { ThemeSwitcher } from './theme-switcher';

export const SHELL_HEADING_ID = 'shell-page-title';
export const MOBILE_NAV_ID = 'shell-mobile-nav';

export type TopbarProps = {
  /** Current surface, used as the page heading. */
  title: string;
  navOpen: boolean;
  onToggleNav: () => void;
};

/**
 * The topbar owns the page <h1>.
 *
 * That is a shell contract, not a style preference: the heading names the
 * surface the router resolved, so it stays correct without every feature page
 * remembering to render one, and it is the label the <main> landmark points
 * at. Feature pages start their own headings at <h2>.
 */
export function Topbar({ title, navOpen, onToggleNav }: TopbarProps) {
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
        <span className="sr-only">{navOpen ? 'Close navigation' : 'Open navigation'}</span>
      </Button>

      <h1
        id={SHELL_HEADING_ID}
        className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-ink"
      >
        {title}
      </h1>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ThemeSwitcher />
      </div>
    </header>
  );
}
