import type { RouteObject } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { scanVaultRoutes } from '@/app/scan-vault-routes';

import { featureRoutes } from './feature-routes';

/**
 * Two features can each add a route array to `featureRoutes` without ever
 * reading each other's files, and nothing stops them declaring the same path.
 * React Router does not warn: equal specificity means the earlier entry wins
 * and the later surface simply never renders.
 *
 * That happened. A read-only assignments surface and the group-administration
 * assignments tab both declared `administer/groups/:groupId/assignments`, both
 * through a constant named `GROUP_ASSIGNMENTS_ROUTE_PATH`, and the read-only
 * one — its component, its hook, its endpoint, its schema and its translations
 * in seven locales — was dead from the moment it merged. Every gate stayed
 * green: typecheck sees two valid modules, and the cold-load sweep sees a
 * healthy page, because the OTHER surface answers.
 *
 * The routes are mounted flat under one shell, so a duplicate path is always a
 * mistake rather than a nesting decision.
 */
function leafPaths(routes: readonly RouteObject[], prefix = ''): string[] {
  return routes.flatMap((route) => {
    const here = route.path ? [prefix, route.path].filter(Boolean).join('/') : prefix;
    const children = route.children ? leafPaths(route.children, here) : [];
    // A pathless layout route contributes its children, not itself.
    return route.path ? [here, ...children] : children;
  });
}

function duplicatesOf(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const path of paths) {
    if (seen.has(path)) duplicated.add(path);
    seen.add(path);
  }
  return [...duplicated].sort();
}

describe('route registration', () => {
  it('declares every feature path exactly once', () => {
    expect(duplicatesOf(leafPaths(featureRoutes))).toEqual([]);
  });

  it('does not let a feature path shadow a Scan Vault tab', () => {
    const vault = leafPaths(scanVaultRoutes);
    const features = leafPaths(featureRoutes);

    expect(duplicatesOf([...vault, ...features])).toEqual([]);
  });

  it('detects a duplicate when one is introduced', () => {
    const withDuplicate: RouteObject[] = [
      { path: 'administer/groups/:groupId/assignments' },
      { element: null, children: [{ path: 'administer/groups/:groupId/assignments' }] },
    ];

    expect(duplicatesOf(leafPaths(withDuplicate))).toEqual([
      'administer/groups/:groupId/assignments',
    ]);
  });
});
