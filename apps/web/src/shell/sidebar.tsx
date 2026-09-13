import { cn } from '@sector/ui';
import { Link } from 'react-router-dom';

import { AccountMenu } from './account-menu';
import { NavList } from './nav-list';
import { SectorMark } from './sector-mark';
import type { NavBadges } from './nav-config';

export function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        'flex items-center gap-2 rounded-token px-1 py-1 outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2',
        'focus-visible:ring-offset-bg',
        className,
      )}
    >
      <SectorMark size={28} />
      <span className="text-[15px] font-semibold tracking-tight text-ink">Sector</span>
    </Link>
  );
}

/**
 * The desktop rail. It carries no background of its own: the parchment --bg
 * runs unbroken from here into the topbar, and only the content panel is
 * inset, so the chrome reads as one continuous frame rather than three boxes.
 *
 * The account control sits on the bottom edge. It needs no `mt-auto`: the nav
 * above it is already `flex-1`, so it eats the slack and this lands last.
 *
 * The rail is `lg:block`, so below that this control is not on screen at all —
 * which is why the topbar keeps its own copy for narrow widths. The two are
 * mounted breakpoint-exclusively and are never both visible; identity on
 * screen twice is the exact fault this shell had before.
 */
export function Sidebar({ badges }: { badges: NavBadges }) {
  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <div className="sticky top-0 flex h-dvh flex-col gap-4 px-3 py-4">
        <BrandMark />

        <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto">
          <NavList badges={badges} />
        </nav>

        <div className="shrink-0 border-t border-line pt-3">
          <AccountMenu placement="rail" />
        </div>
      </div>
    </aside>
  );
}
