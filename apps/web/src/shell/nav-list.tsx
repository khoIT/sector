import { Badge, cn } from '@scanvault/ui';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';

import {
  isNavItemActive,
  visibleNavGroups,
  type NavBadges,
  type ResolvedNavItem,
} from './nav-config';

/** 2 002 pending scans is a real local count. Keep the pill one pill wide. */
function formatBadge(count: number): string {
  return count > 99 ? '99+' : String(count);
}

function NavItemLink({
  item,
  active,
  onNavigate,
}: {
  item: ResolvedNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const badge = item.badge;

  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      // Not NavLink: the entry owns a whole subtree (/scans/group/...) while
      // linking to one leaf inside it, so active state comes from matchPrefix,
      // not from the href.
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-token py-2 pr-2 text-body transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-accent-ink',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        active
          ? 'bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--line)]'
          : 'text-ink-dim hover:bg-surface-2 hover:text-ink',
      )}
    >
      {/* Active marker in the fills-only accent; the label stays --ink. */}
      <span
        aria-hidden
        className={cn(
          'ml-1 h-4 w-[3px] shrink-0 rounded-full transition-colors',
          active ? 'bg-accent' : 'bg-transparent',
        )}
      />
      <Icon className={cn('h-4 w-4 shrink-0', active && 'text-accent-ink')} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>

      {typeof badge === 'number' && badge > 0 ? (
        <Badge tone="accent" className="sv-num shrink-0">
          {formatBadge(badge)}
          <span className="sr-only"> {item.badgeLabel ?? 'items'}</span>
        </Badge>
      ) : null}
    </Link>
  );
}

export type NavListProps = {
  badges: NavBadges;
  /** Called after a link is followed, so the mobile panel can close itself. */
  onNavigate?: () => void;
  className?: string;
};

/**
 * The nav itself, rendered identically by the desktop rail and the mobile
 * disclosure panel. Only one of the two is ever displayed, so both may carry
 * the same landmark label.
 */
export function NavList({ badges, onNavigate, className }: NavListProps) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const groups = visibleNavGroups(user, badges);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {groups.map((group) => (
        <div key={group.id}>
          {group.showLabel ? (
            <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-dim">
              {group.label}
            </p>
          ) : null}

          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.id}>
                <NavItemLink
                  item={item}
                  active={isNavItemActive(item, pathname)}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
