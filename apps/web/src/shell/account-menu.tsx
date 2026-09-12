import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
  useTheme,
  type ThemePreference,
} from '@scanvault/ui';
import { Check, ChevronDown, LogOut, Monitor, Moon, Sun, User, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';

import { LogoutDialog } from './logout-dialog';
import { accountDisplayName, initialsFor, realPhotoUrl, roleLabel } from './user-initials';

type ThemeOption = { value: ThemePreference; label: string; Icon: LucideIcon };

const THEME_OPTIONS: readonly ThemeOption[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

/**
 * Who you are signed in as, and what you can do about it.
 *
 * The header never said. That matters more here than on a normal app because
 * the permission model is the whole product: which tabs exist, whether the
 * Assess button is live, and the rule that you cannot assess your own scan are
 * all decided by the role — and a user can only reason about any of it if the
 * row and the header agree on who they are.
 *
 * No request. The legacy `UserNav` fetches `GET /api/account/profile` on every
 * mount purely to draw an avatar and a name; `authUserSchema` already carries
 * every field this needs, populated at login and on `GET /api/me`. That also
 * removes the skeleton the legacy header flashes on each page load.
 */
export function AccountMenu() {
  const auth = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const user = auth.user;
  if (!user) return null;

  const name = accountDisplayName(user);
  const role = roleLabel(user.role?.name);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-token border border-transparent px-1 py-1',
            'outline-none transition-colors hover:border-line hover:bg-surface-2',
            'focus-visible:ring-2 focus-visible:ring-accent-ink',
            'data-[state=open]:border-line data-[state=open]:bg-surface-2',
          )}
          aria-label={`Account: ${name}${role ? `, ${role}` : ''}`}
        >
          <Avatar user={user} />

          {/* Below md the avatar carries the whole control; the name and role
              are in the aria-label above and in the menu itself. */}
          <span className="hidden min-w-0 flex-col items-start leading-tight md:flex">
            <span className="max-w-[10rem] truncate text-[13px] font-medium text-ink">{name}</span>
            {role ? (
              <span className="max-w-[10rem] truncate text-[11px] text-ink-dim">{role}</span>
            ) : null}
          </span>

          <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-ink-dim md:block" aria-hidden />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar user={user} />
            <div className="min-w-0">
              <p className="truncate text-body font-medium text-ink">{name}</p>
              {/* The email disambiguates the several test accounts people run
                  side by side locally, which is exactly when this menu is open. */}
              <p className="truncate text-[11px] text-ink-dim">{user.email}</p>
              {role ? <p className="truncate text-[11px] text-accent-ink">{role}</p> : null}
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link to="/profile">
              <User className="h-4 w-4 shrink-0" aria-hidden />
              Profile
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          {THEME_OPTIONS.map(({ value, label, Icon }) => {
            const active = theme === value;
            return (
              <DropdownMenuItem
                key={value}
                // Keep the menu open: picking a theme is something you look at
                // to judge, and reopening the menu to try the next one makes
                // comparing them needlessly awkward.
                onSelect={(event) => {
                  event.preventDefault();
                  setTheme(value);
                }}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {value === 'system' ? `System (${resolvedTheme})` : label}
                {active ? (
                  <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-accent-ink" aria-hidden />
                ) : null}
                <span className="sr-only">{active ? ' (selected)' : ''}</span>
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            tone="crit"
            onSelect={(event) => {
              // Radix returns focus to the trigger as it closes. Opening the
              // dialog on the next frame lets that finish first, so the dialog
              // keeps the focus rather than losing it to the trigger.
              event.preventDefault();
              requestAnimationFrame(() => setLogoutOpen(true));
            }}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            Sign out
          </DropdownMenuItem>

          {/* Not a menu item: it is here so a bug report can name a build. */}
          <p className="px-2 pb-1 pt-1.5 text-[11px] text-ink-dim">
            Build <span className="sv-num">{__APP_COMMIT__}</span>
          </p>
        </DropdownMenuContent>
      </DropdownMenu>

      {logoutOpen ? <LogoutDialog open onOpenChange={setLogoutOpen} /> : null}
    </>
  );
}

/**
 * Initials, with the photo branch kept for the day there is one.
 *
 * `photo` is empty on all 3,151 users today, so initials are what this renders
 * in practice — but the field is on the wire and the profile page adds the
 * upload that fills it.
 *
 * The photo URL is a presigned S3 link with a 24-hour expiry stored alongside
 * the session, so a tab left open past that point gets a broken image. Fall
 * back to initials rather than to an alt-text box.
 */
function Avatar({
  user,
}: {
  user: {
    firstName?: string | null;
    lastName?: string | null;
    userName: string;
    photo?: string | null;
  };
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = realPhotoUrl(user.photo);

  if (photo && !photoFailed) {
    return (
      <img
        src={photo}
        alt=""
        onError={() => setPhotoFailed(true)}
        className="h-7 w-7 shrink-0 rounded-full border border-line object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
        'border border-accent-ink/25 bg-accent-soft text-[11px] font-semibold text-accent-ink',
      )}
    >
      {initialsFor(user)}
    </span>
  );
}
