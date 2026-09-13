import { GraduationCap, ListChecks, type LucideIcon } from 'lucide-react';

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
 * the real page under the same path, and the rail follows.
 */

export type UnbuiltSurfaceId = 'courses' | 'question-banks';

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
  'question-banks': {
    path: '/learn/question-banks',
    permission: null,
    labelKey: 'nav.questionBanks',
    icon: ListChecks,
  },
};
