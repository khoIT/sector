import { SCAN_LIST_VIEWS, scanKeys, type Scan, type ScanListView } from '@sector/api-client';
import type { LearnerCourseListItem } from '@sector/api-client';

import { coursePathFor } from '@/features/courses/courses-links';
import { scanDetailPathFor } from '@/features/scan-detail/scan-detail-links';

import type { NavGroup, ResolvedNavItem } from '../nav-destinations';
import type { CommandItem } from './filter-commands';

/**
 * What the command menu can offer, built from what is already in hand.
 *
 * Nothing here fetches. The nav comes from the same `visibleNavGroups(user)`
 * the rail renders, so a learner can never be offered a destination the rail
 * would not show them, and the scans and courses come out of the query cache —
 * pages the user has already loaded. A cold cache means those sections are
 * absent, which is honest; a menu that fires four requests on ⌘K is a menu
 * that feels slow exactly when it is meant to feel instant.
 *
 * Every function takes plain data rather than reading a `QueryClient`, so the
 * shaping is testable in the node environment the suites run in.
 */

/** The cache rows `queryClient.getQueriesData()` hands back. */
export type CachedQuery = readonly [readonly unknown[], unknown];

const VIEW_BY_LIST_KEY = new Map<unknown, ScanListView>(
  SCAN_LIST_VIEWS.map((view) => [scanKeys.listRoot(view)[0], view]),
);

export function navCommands(
  groups: readonly NavGroup<ResolvedNavItem>[],
  translate: (key: string) => string,
): CommandItem[] {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      id: `nav:${item.id}`,
      group: 'nav' as const,
      label: translate(item.labelKey),
      // The section, so two similarly named surfaces are told apart.
      hint: group.showLabel ? translate(group.labelKey) : null,
      path: item.path,
    })),
  );
}

function listItems(data: unknown): unknown[] {
  return Array.isArray((data as { items?: unknown })?.items)
    ? ((data as { items: unknown[] }).items ?? [])
    : [];
}

/**
 * Scans from every cached list page, newest first as the server returned
 * them, deduped: the same scan appears in both the unreviewed and reviewed
 * lists of a reviewer who has visited both.
 */
export function cachedScanCommands(entries: readonly CachedQuery[]): CommandItem[] {
  const seen = new Set<string>();
  const commands: CommandItem[] = [];

  for (const [key, data] of entries) {
    const view = VIEW_BY_LIST_KEY.get(key[0]);
    if (!view) continue;

    for (const raw of listItems(data)) {
      const scan = raw as Scan;
      if (!scan?.id || !scan.title || seen.has(scan.id)) continue;
      seen.add(scan.id);
      commands.push({
        id: `scan:${scan.id}`,
        group: 'scan',
        label: scan.title,
        hint: scan.scanIdentifier ?? scan.scanType?.name ?? null,
        path: scanDetailPathFor(view, scan.id),
      });
    }
  }

  return commands;
}

export function cachedCourseCommands(entries: readonly CachedQuery[]): CommandItem[] {
  const seen = new Set<string>();
  const commands: CommandItem[] = [];

  for (const [, data] of entries) {
    for (const raw of listItems(data)) {
      const enrolment = raw as LearnerCourseListItem;
      const course = enrolment?.course;
      if (!course?.id || !course.title || seen.has(course.id)) continue;
      seen.add(course.id);
      commands.push({
        id: `course:${course.id}`,
        group: 'course',
        label: course.title,
        hint: null,
        path: coursePathFor(course.id),
      });
    }
  }

  return commands;
}

export function commandSources({
  navGroups,
  scanQueries,
  courseQueries,
  translate,
}: {
  navGroups: readonly NavGroup<ResolvedNavItem>[];
  scanQueries: readonly CachedQuery[];
  courseQueries: readonly CachedQuery[];
  translate: (key: string) => string;
}): CommandItem[] {
  return [
    ...navCommands(navGroups, translate),
    ...cachedScanCommands(scanQueries),
    ...cachedCourseCommands(courseQueries),
  ];
}
