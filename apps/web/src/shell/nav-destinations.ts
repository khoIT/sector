import { hasPermission, type AuthUser } from '@sector/api-client';
import type { LucideIcon } from 'lucide-react';

import { SCAN_VAULT_PATH, type ScanVaultView } from '@/features/scan-list/scan-list-views';
import { canOpenView } from '@/features/scan-list/tabs/scan-tab-model';

/**
 * What the rail can send someone to.
 *
 * The first version of this model did not have a type for a destination: an
 * entry WAS an ordered list of `ScanVaultView`s, and its id was a four-member
 * union of scan surfaces. Courses, question banks, the pathology gallery and
 * group administration could not be written down at all — not for want of a
 * route, but because the type had no room for a destination that is not a list
 * of scans.
 *
 * So a destination is now the general thing: a label, an icon, a URL, and a
 * predicate over the signed-in user. The Scan Vault's "land on the first list
 * this role may read" rule survives intact as ONE constructor of that shape
 * (`scanVaultDestination` below) rather than as the shape itself.
 */

/** Whether this user sees the entry at all. */
export type NavVisibility = (user: AuthUser | null) => boolean;

/**
 * Where the entry links. A plain string for a fixed surface; a function for
 * the Scan Vault entries, whose landing list depends on which of the lists
 * beneath them the role may actually read.
 */
export type NavPath = string | ((user: AuthUser | null) => string | undefined);

export type NavDestination<TId extends string = string> = {
  id: TId;
  /**
   * Translation key. The English text lives in `i18n/locales/en.json` with the
   * rest of the strings rather than here, so a translator has one file to work
   * from and this table stays a description of structure.
   */
  labelKey: string;
  icon: LucideIcon;
  path: NavPath;
  visibleWhen: NavVisibility;
  /**
   * Subtree the entry owns, for active-state matching. Usually its own path —
   * but a Scan Vault entry owns `/scans/group` while linking at one leaf
   * inside it, which is why this is a separate field.
   */
  matchPrefix: string;
  /** What the badge counts, for the screen-reader label. */
  badgeLabel?: string;
};

/** A destination with its URL and live badge resolved for one user. */
export type ResolvedNavItem<TId extends string = string> = Omit<NavDestination<TId>, 'path'> & {
  path: string;
  /** Live count. Populated by useNavBadges(); never hard-coded. */
  badge?: number;
};

export type NavGroup<TItem = NavDestination> = {
  id: string;
  labelKey: string;
  /** The legacy GroupMenu carried `isVisible` for label-less groups. */
  showLabel: boolean;
  items: readonly TItem[];
};

/**
 * The ordinary gate: hold the permission or do not see the entry.
 *
 * `null` means every signed-in user, and it is a decision rather than an
 * omission — the legacy tab bar gated Shared Scans on nothing because a share
 * is granted per scan, and the server scopes the list to the caller. Spelling
 * the null case here keeps "no permission applies" distinguishable from "the
 * gate was forgotten", which is the hole the legacy NavigationTabs left open
 * by treating a missing permission as "always allow".
 */
export function whenPermitted(permission: string | null): NavVisibility {
  if (permission === null) return () => true;
  return (user) => hasPermission(user, permission);
}

export type ScanVaultDestinationSpec<TId extends string> = {
  id: TId;
  labelKey: string;
  icon: LucideIcon;
  /**
   * The surfaces this entry covers, in order. Visibility is "any of these",
   * and the first one the role may open becomes the link target.
   */
  views: readonly ScanVaultView[];
  matchPrefix: string;
  badgeLabel?: string;
};

/**
 * The Scan Vault entries, and the only destinations whose URL depends on who
 * is asking.
 *
 * A reviewer who can see reviewed group scans but not the unreviewed queue
 * still gets a working Group Scans entry, pointing at the list they can
 * actually read. That is the whole of the special case, and it lives here so
 * that the rest of the model — and every section added after this one — never
 * has to know the Scan Vault exists.
 *
 * URLs and permissions are NOT restated here. Both come from
 * features/scan-list/scan-list-views.ts via `canOpenView()`, which the in-page
 * tab bar and the router read too, so a path or a gate cannot drift between
 * the three.
 */
export function scanVaultDestination<TId extends string>(
  spec: ScanVaultDestinationSpec<TId>,
): NavDestination<TId> {
  const landingFor = (user: AuthUser | null): ScanVaultView | undefined =>
    spec.views.find((view) => canOpenView(user, view));

  return {
    id: spec.id,
    labelKey: spec.labelKey,
    icon: spec.icon,
    matchPrefix: spec.matchPrefix,
    badgeLabel: spec.badgeLabel,
    // Both fields read the same `landingFor`, so the entry is visible exactly
    // when a surface under it resolves and the rail can never show a link it
    // cannot build.
    visibleWhen: (user) => landingFor(user) !== undefined,
    path: (user) => {
      const landing = landingFor(user);
      return landing && SCAN_VAULT_PATH[landing];
    },
  };
}

/**
 * The entry as the rail renders it, or nothing when this user may not have it.
 *
 * Both ways of disappearing are checked here: the predicate says no, or the
 * destination resolves to no URL for this user. They cannot disagree for a
 * Scan Vault entry, and for a fixed-path entry the second never fires.
 */
export function resolveNavDestination<TId extends string>(
  destination: NavDestination<TId>,
  user: AuthUser | null,
  badge?: number,
): ResolvedNavItem<TId> | undefined {
  if (!destination.visibleWhen(user)) return undefined;

  const path = typeof destination.path === 'function' ? destination.path(user) : destination.path;
  if (path === undefined) return undefined;

  return { ...destination, path, badge };
}

/**
 * Active when the path is inside the entry's subtree. The boundary check
 * matters: a bare `startsWith` would light up "Group Scans" for a future
 * `/scans/grouped` route.
 */
export function isNavItemActive(
  destination: Pick<NavDestination, 'matchPrefix'>,
  pathname: string,
): boolean {
  return pathname === destination.matchPrefix || pathname.startsWith(`${destination.matchPrefix}/`);
}
