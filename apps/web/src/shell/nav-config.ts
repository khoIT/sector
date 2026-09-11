import type { AuthUser } from '@scanvault/api-client';
import { BookOpen, FolderClock, Share2, Users2, type LucideIcon } from 'lucide-react';

import { SCAN_VAULT_PATH, type ScanVaultView } from '@/features/scan-list/scan-list-views';
import { canOpenView } from '@/features/scan-list/tabs/scan-tab-model';

/**
 * The shell's navigation, as data.
 *
 * Mirrors the legacy `Menu` / `GroupMenu` shape from
 * gusi_web_dashboard/src/config/links.ts — path, label, icon, optional
 * permission, optional numeric badge, grouped under a label that can be
 * hidden — but carries only surfaces that exist here, so there are no dead
 * links.
 *
 * URLs and permissions are NOT restated here. They come from
 * features/scan-list/scan-list-views.ts, which is the one place the Scan Vault
 * routes are defined; the sidebar, the in-page tab bar and the router all read
 * the same table, so a path cannot drift between them.
 *
 * The legacy type declared `badge?: number` and NOTHING ever set it. Here the
 * field is live: `useNavBadges()` fills it from the real queue counts.
 */

export type NavItemId = 'my-scans' | 'shared-scans' | 'group-scans' | 'expert-scans';

export type NavItem = {
  id: NavItemId;
  label: string;
  icon: LucideIcon;
  /**
   * The surfaces this entry covers, in order. Visibility is "any of these",
   * and the first one the role may open becomes the link target — so a user
   * who can see reviewed group scans but not the unreviewed queue still gets
   * a working Group Scans entry pointing at the list they can actually read.
   */
  views: readonly ScanVaultView[];
  /** Subtree the entry owns, for active-state matching. */
  matchPrefix: string;
  /** What the badge counts, for the screen-reader label. */
  badgeLabel?: string;
};

/** A nav item with its destination and live badge resolved for this user. */
export type ResolvedNavItem = NavItem & {
  path: string;
  /** Live count. Populated by useNavBadges(); never hard-coded. */
  badge?: number;
};

export type NavGroup<TItem extends NavItem = NavItem> = {
  id: string;
  label: string;
  /** The legacy GroupMenu carried `isVisible` for label-less groups. */
  showLabel: boolean;
  items: TItem[];
};

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'scan-vault',
    label: 'Scan Vault',
    showLabel: true,
    items: [
      { id: 'my-scans', label: 'My Scans', icon: BookOpen, views: ['my'], matchPrefix: '/scans/my' },
      {
        // Ungated on purpose, as in the legacy tab bar: a share is granted per
        // scan and the server scopes the list to the caller, so there is no
        // role permission to check.
        id: 'shared-scans',
        label: 'Shared Scans',
        icon: Share2,
        views: ['shared'],
        matchPrefix: '/scans/shared',
      },
      {
        id: 'group-scans',
        label: 'Group Scans',
        icon: Users2,
        views: ['pending', 'reviewed'],
        matchPrefix: '/scans/group',
        badgeLabel: 'scans waiting for review',
      },
      {
        id: 'expert-scans',
        label: 'Expert Scans',
        icon: FolderClock,
        views: ['expert', 'expert-reviewed'],
        matchPrefix: '/scans/expert',
        badgeLabel: 'expert scans waiting for review',
      },
    ],
  },
];

/** Badge counts keyed by nav item id. Missing or 0 renders no pill. */
export type NavBadges = Partial<Record<NavItemId, number>>;

/**
 * Active when the path is inside the entry's subtree. The boundary check
 * matters: a bare `startsWith` would light up "Group Scans" for a future
 * `/scans/grouped` route.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
}

/**
 * The nav this role may actually use, with destinations and badges resolved.
 * Entries whose every surface is denied are dropped, and so is a group left
 * with no entries, so no empty heading is rendered.
 */
export function visibleNavGroups(
  user: AuthUser | null,
  badges: NavBadges = {},
): NavGroup<ResolvedNavItem>[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.flatMap<ResolvedNavItem>((item) => {
      const landing = item.views.find((view) => canOpenView(user, view));
      if (!landing) return [];
      return [{ ...item, path: SCAN_VAULT_PATH[landing], badge: badges[item.id] }];
    }),
  })).filter((group) => group.items.length > 0);
}

/** Where `/` should land: the first surface this role is allowed to open. */
export function firstVisibleNavItem(user: AuthUser | null): ResolvedNavItem | undefined {
  return visibleNavGroups(user)[0]?.items[0];
}

/** The entry a URL belongs to. */
export function activeNavItem(pathname: string): NavItem | undefined {
  return NAV_GROUPS.flatMap((group) => group.items).find((item) =>
    isNavItemActive(item, pathname),
  );
}

/**
 * Heading for the current URL — the SECTION, not the surface.
 *
 * The topbar is persistent chrome, so it sits one level up: "Group Scans"
 * here, while the page's own <h2> names the exact list ("Group Scans —
 * Reviewed"). Putting the full title in both produced the same sentence twice,
 * one above the other.
 */
export function shellTitleFor(pathname: string): string {
  return activeNavItem(pathname)?.label ?? 'Scan Vault';
}
