import { userDisplayName } from '@scanvault/api-client';
import { Button, cn } from '@scanvault/ui';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';

import { NavList } from './nav-list';
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
      {/* The one orange fill in the shell. Its label is --scan-ground: --ink
          would drop to 2.4:1 on the orange once the palette flips to dark. */}
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-token bg-accent text-[12px] font-bold text-scan-ground"
      >
        SV
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink">ScanVault</span>
    </Link>
  );
}

/** Identity + sign out. Rendered in the desktop rail and the mobile panel. */
export function UserSummary({ className }: { className?: string }) {
  const { user, role, signOut } = useAuth();
  const [photoFailed, setPhotoFailed] = useState(false);

  if (!user) return null;

  const name = userDisplayName(user);
  const initials =
    `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
    name.slice(0, 2).toUpperCase();

  return (
    <div className={cn('flex items-center gap-2 rounded-token border border-line p-2', className)}>
      {/* The photo URL is a presigned S3 link with a 24h expiry that is stored
          alongside the session, so a tab open past that point gets a broken
          image. Fall back to initials rather than an alt-text box. */}
      {user.photo && !photoFailed ? (
        <img
          src={user.photo}
          alt=""
          onError={() => setPhotoFailed(true)}
          className="h-7 w-7 shrink-0 rounded-full border border-line object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink-dim"
        >
          {initials}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium text-ink">{name}</span>
        {role ? (
          <span className="block truncate text-[11px] capitalize text-ink-dim">{role.name}</span>
        ) : null}
      </span>

      <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
        <LogOut className="h-4 w-4" aria-hidden />
        <span className="sr-only">Sign out</span>
      </Button>
    </div>
  );
}

/**
 * The desktop rail. It carries no background of its own: the parchment --bg
 * runs unbroken from here into the topbar, and only the content panel is
 * inset, so the chrome reads as one continuous frame rather than three boxes.
 */
export function Sidebar({ badges }: { badges: NavBadges }) {
  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <div className="sticky top-0 flex h-dvh flex-col gap-4 px-3 py-4">
        <BrandMark />

        <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto">
          <NavList badges={badges} />
        </nav>

        <UserSummary />
      </div>
    </aside>
  );
}
