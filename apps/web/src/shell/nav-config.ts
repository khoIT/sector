import type { AuthUser } from '@sector/api-client';
import { BookOpen, FolderClock, ListChecks, Share2, Users2 } from 'lucide-react';

import { QUESTION_BANK_LIST_PATH } from '@/features/question-banks/question-bank-links';
import { UNBUILT_SURFACES, type UnbuiltSurfaceId } from '@/routes/unbuilt-surfaces';

import {
  isNavItemActive,
  resolveNavDestination,
  scanVaultDestination,
  whenPermitted,
  type NavDestination,
  type NavGroup,
  type ResolvedNavItem,
} from './nav-destinations';

/**
 * The shell's navigation, as data.
 *
 * Mirrors the legacy `Menu` / `GroupMenu` shape from
 * gusi_web_dashboard/src/config/links.ts — path, label, icon, optional
 * permission, optional numeric badge, grouped under a label that can be
 * hidden — but every entry here resolves to a page. Legacy links.ts listed
 * surfaces whose routes had been removed; the sections that have no feature
 * behind them yet are routed to a placeholder that says so, not left to 404.
 *
 * The shape of an ENTRY lives in ./nav-destinations.ts; this file is the
 * table. Anything that is not a scan list joins it the same way the Scan Vault
 * entries do, which is the point of the split: the Scan Vault's landing rule
 * is one constructor there, not a property of navigation itself.
 *
 * The legacy type declared `badge?: number` and NOTHING ever set it. Here the
 * field is live: `useNavBadges()` fills it from the real queue counts.
 */

/**
 * A section that is in the rail before its surface exists. Label, icon, URL
 * and gate all come from the one table the router reads too.
 */
function unbuiltDestination<TId extends UnbuiltSurfaceId>(id: TId): NavDestination<TId> {
  const surface = UNBUILT_SURFACES[id];

  return {
    id,
    labelKey: surface.labelKey,
    icon: surface.icon,
    path: surface.path,
    matchPrefix: surface.path,
    visibleWhen: whenPermitted(surface.permission),
  };
}

/**
 * Question banks: the first Learn surface with a real page behind it. Its id,
 * path and label key are unchanged from when this was an `unbuiltDestination`
 * row — only the surface behind them is new — declared directly here rather
 * than read from ./unbuilt-surfaces.ts now that the row it used to come from
 * is gone. `/api/v2/question-banks*` guards on nothing but a signed-in
 * session, so this is ungated like Shared Scans.
 */
const questionBanksDestination: NavDestination<'question-banks'> = {
  id: 'question-banks',
  labelKey: 'nav.questionBanks',
  icon: ListChecks,
  path: QUESTION_BANK_LIST_PATH,
  matchPrefix: QUESTION_BANK_LIST_PATH,
  visibleWhen: whenPermitted(null),
};

/*
 * Written without a `satisfies readonly NavGroup[]` clause, and that is load
 * bearing: the clause contextually types every entry as NavDestination<string>,
 * which widens each `id` back to `string` and quietly turns NavItemId below
 * into `string` — no error anywhere, just a badge key nobody checks any more.
 * The shape is still enforced, by visibleNavGroups() and activeNavItem() using
 * these entries as NavDestination.
 */
export const NAV_GROUPS = [
  {
    id: 'scan-vault',
    labelKey: 'nav.section',
    showLabel: true,
    items: [
      scanVaultDestination({
        id: 'my-scans',
        labelKey: 'nav.myScans',
        icon: BookOpen,
        views: ['my'],
        matchPrefix: '/scans/my',
      }),
      scanVaultDestination({
        // Ungated on purpose, as in the legacy tab bar: a share is granted per
        // scan and the server scopes the list to the caller, so there is no
        // role permission to check.
        id: 'shared-scans',
        labelKey: 'nav.sharedScans',
        icon: Share2,
        views: ['shared'],
        matchPrefix: '/scans/shared',
      }),
      scanVaultDestination({
        id: 'group-scans',
        labelKey: 'nav.groupScans',
        icon: Users2,
        views: ['pending', 'reviewed'],
        matchPrefix: '/scans/group',
        badgeLabel: 'scans waiting for review',
      }),
      scanVaultDestination({
        id: 'expert-scans',
        labelKey: 'nav.expertScans',
        icon: FolderClock,
        views: ['expert', 'expert-reviewed'],
        matchPrefix: '/scans/expert',
        badgeLabel: 'expert scans waiting for review',
      }),
    ],
  },
  {
    id: 'learn',
    labelKey: 'nav.learn',
    showLabel: true,
    items: [unbuiltDestination('courses'), questionBanksDestination],
  },
  {
    id: 'administer',
    labelKey: 'nav.administer',
    showLabel: true,
    // One entry, and most roles do not hold its permission — which is exactly
    // the case visibleNavGroups() has to drop rather than render as a heading
    // with nothing under it.
    items: [unbuiltDestination('group-administration')],
  },
] as const;

/**
 * Derived from the table rather than declared beside it.
 *
 * It used to be a hand-written union of the four scan ids, so every section
 * added after the Scan Vault meant editing a type in one place and a table in
 * another, and forgetting the first was a compile error pointing at the wrong
 * file. Adding a row now widens the id, and a badge keyed to an entry that no
 * longer exists still fails to compile.
 */
export type NavItemId = (typeof NAV_GROUPS)[number]['items'][number]['id'];

/** Badge counts keyed by nav item id. Missing or 0 renders no pill. */
export type NavBadges = Partial<Record<NavItemId, number>>;

/**
 * The nav this role may actually use, with destinations and badges resolved.
 * Entries whose predicate fails are dropped, and so is a group left with no
 * entries, so no empty heading is rendered.
 */
export function visibleNavGroups(
  user: AuthUser | null,
  badges: NavBadges = {},
): NavGroup<ResolvedNavItem>[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.flatMap<ResolvedNavItem>((item) => {
      const resolved = resolveNavDestination(item, user, badges[item.id]);
      return resolved ? [resolved] : [];
    }),
  })).filter((group) => group.items.length > 0);
}

/** Where `/` should land: the first surface this role is allowed to open. */
export function firstVisibleNavItem(user: AuthUser | null): ResolvedNavItem | undefined {
  return visibleNavGroups(user)[0]?.items[0];
}

/** The entry a URL belongs to. */
export function activeNavItem(pathname: string): NavDestination | undefined {
  return NAV_GROUPS.flatMap<NavDestination>((group) => [...group.items]).find((item) =>
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
export function shellTitleKeyFor(pathname: string): string {
  return activeNavItem(pathname)?.labelKey ?? 'nav.section';
}
