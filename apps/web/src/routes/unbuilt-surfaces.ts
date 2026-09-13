import { GraduationCap, Settings2, type LucideIcon } from 'lucide-react';

import { SCAN_VAULT_PERMISSION } from '@/features/scan-list/scan-list-views';

/**
 * Sections that have a place in the rail and a URL, and nothing behind them
 * yet.
 *
 * They exist so the widened navigation model is exercised by the running app
 * rather than only by a test: each one is a destination that is not a scan
 * list, mounted at a real route, gated by the same predicate machinery as
 * everything else.
 *
 * Both readers come here for the path and the permission — shell/nav-config.ts
 * for the rail entry, routes/unbuilt-surface-routes.tsx for the route — the
 * way the Scan Vault tabs come to scan-list-views.ts. A menu entry cannot
 * point at a path nobody routed, which is what the legacy dashboard shipped:
 * `links.ts` listed surfaces whose routes had been removed, and clicking one
 * landed on a blank page.
 *
 * Retiring one of these is a deletion, not a migration: drop the row, mount
 * the real page under the same path, and the rail follows. `question-banks`
 * was the first to go — its real routes live in
 * apps/web/src/features/question-banks/question-bank-routes.tsx now, mounted
 * at the exact path this table used to point at, and its nav entry
 * (id `question-banks`, path `/learn/question-banks`, label key
 * `nav.questionBanks`) is declared directly in shell/nav-config.ts instead of
 * being derived from a row here.
 */

export type UnbuiltSurfaceId = 'courses' | 'group-administration';

export type UnbuiltSurface = {
  /** Absolute URL, for links; the router mounts it relative. */
  path: string;
  /**
   * Permission the rail entry and the route both check. `null` means every
   * signed-in user, as it does for Shared Scans.
   */
  permission: string | null;
  /** Translation key; the English lives in i18n/locales/en.json. */
  labelKey: string;
  icon: LucideIcon;
};

export const UNBUILT_SURFACES: Readonly<Record<UnbuiltSurfaceId, UnbuiltSurface>> = {
  courses: {
    path: '/learn/courses',
    permission: null,
    labelKey: 'nav.courses',
    icon: GraduationCap,
  },
  'group-administration': {
    path: '/administer/groups',
    // BORROWED, and only until there is something real behind this route.
    // The seeded roles carry no `manage:group` string — checked against
    // POST /api/login for all four demo accounts — so gating on one would hide
    // the entry from everybody, including the people it is for, and the
    // widened nav model would go unexercised by the running app. What marks a
    // group leader in this data is the group queue, so that is what is read
    // here — by reference, never as a second copy of the literal, because the
    // scan permissions have exactly one home and a rename there has to reach
    // every reader. Give group administration its own permission before
    // putting anything behind this route: the gate is right about WHO today
    // and wrong about WHY, which stops being harmless the moment the page
    // shows group data.
    permission: SCAN_VAULT_PERMISSION.pending,
    labelKey: 'nav.groupAdministration',
    icon: Settings2,
  },
};
