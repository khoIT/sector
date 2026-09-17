import type { RouteObject } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { appShellRoutes } from '@/app/app-shell-routes';

import { measureFromMatches, pageMeasure, routeMeasures } from './route-measure';

/**
 * Every route says how wide it is.
 *
 * The app shell used to cap all of them at 1400px. Now it caps nothing, which
 * means a route that declares no measure renders at whatever width its content
 * happens to take — and nothing on screen says so. That is a mistake you find
 * months later on someone else's monitor, so it is a failing test here
 * instead.
 */
describe('route measures', () => {
  // Walked from the real root, exactly as the router mounts it: the shell's
  // own index, the legacy-root redirects and the catch-all all live there, and
  // a walk of `featureRoutes` and `scanVaultRoutes` alone never sees them.
  const declared = routeMeasures([{ path: '/', children: appShellRoutes }]);

  it('covers every leaf route', () => {
    const undeclared = declared.filter((entry) => !entry.measure).map((entry) => entry.path);

    expect(undeclared).toEqual([]);
  });

  it('declares a measure for a meaningful number of routes', () => {
    // A guard against the walk silently returning nothing — an empty list
    // would make the assertion above pass while proving the opposite.
    expect(declared.length).toBeGreaterThan(20);
  });

  it('only uses the three measures the shell knows how to render', () => {
    const unknown = declared
      .map((entry) => entry.measure)
      .filter((measure) => measure && !['reading', 'working', 'full'].includes(measure));

    expect(unknown).toEqual([]);
  });

  it('gives the course player its own width and the outline under it a narrower one', () => {
    // The one place the inheritance rule earns its keep: the shell is `full`
    // so a 16:9 video is not letterboxed, and the outline child takes the
    // narrower measure back.
    const byPath = new Map(declared.map((entry) => [entry.path, entry.measure]));

    expect(byPath.get('/learn/courses/:courseId')).toBe('working');
    expect(byPath.get('/learn/courses/:courseId/:itemId')).toBe('full');
  });
});

describe('routeMeasures', () => {
  it('resolves a parent path to its index child measure', () => {
    // Visiting `parent` renders the index child, so `parent` is as wide as
    // that child says — not as wide as the layout route wrapping it.
    const routes: RouteObject[] = [
      {
        path: 'parent',
        handle: pageMeasure('full'),
        children: [{ index: true, handle: pageMeasure('working') }, { path: ':itemId' }],
      },
    ];

    expect(routeMeasures(routes)).toEqual([
      { path: 'parent', measure: 'working' },
      { path: 'parent/:itemId', measure: 'full' },
    ]);
  });

  it('finds an index route through a pathless permission gate', () => {
    // The two conventions combined: a surface wrapped in `<RequirePermission>`
    // whose index child declares the measure. Looking only one level down
    // reports the gate's measure for a URL the router renders with the index
    // child's — and reports `undefined` when only the index child declares one,
    // which fails the coverage test on a route that IS declared.
    const routes: RouteObject[] = [
      {
        path: 'parent',
        handle: pageMeasure('full'),
        children: [
          {
            element: null,
            children: [{ index: true, handle: pageMeasure('reading') }, { path: 'child' }],
          },
        ],
      },
    ];

    expect(routeMeasures(routes)).toEqual([
      { path: 'parent', measure: 'reading' },
      { path: 'parent/child', measure: 'full' },
    ]);
  });

  it('does not take an index route from a child that has its own path', () => {
    // `parent/child`'s index answers for `parent/child`, never for `parent`.
    const routes: RouteObject[] = [
      {
        path: 'parent',
        handle: pageMeasure('full'),
        children: [{ path: 'child', children: [{ index: true, handle: pageMeasure('reading') }] }],
      },
    ];

    expect(routeMeasures(routes)).toEqual([
      { path: 'parent', measure: 'full' },
      { path: 'parent/child', measure: 'reading' },
    ]);
  });

  it('lets a child inherit its parent layout route measure', () => {
    const routes: RouteObject[] = [
      {
        path: 'parent',
        handle: pageMeasure('full'),
        children: [{ path: 'child' }],
      },
    ];

    expect(routeMeasures(routes)).toEqual([
      { path: 'parent', measure: 'full' },
      { path: 'parent/child', measure: 'full' },
    ]);
  });

  it('lets a child override its parent', () => {
    const routes: RouteObject[] = [
      {
        path: 'parent',
        handle: pageMeasure('full'),
        children: [{ path: 'child', handle: pageMeasure('reading') }],
      },
    ];

    expect(routeMeasures(routes).at(-1)).toEqual({ path: 'parent/child', measure: 'reading' });
  });

  it('carries a measure through a pathless permission gate without listing it', () => {
    // `RequirePermission` wrappers have no path and must not appear as routes,
    // but a measure declared above one still has to reach the leaf.
    const routes: RouteObject[] = [
      { element: null, handle: pageMeasure('working'), children: [{ path: 'gated' }] },
    ];

    expect(routeMeasures(routes)).toEqual([{ path: 'gated', measure: 'working' }]);
  });

  it('reports a leaf with no measure anywhere in its chain', () => {
    expect(routeMeasures([{ path: 'forgotten' }])).toEqual([
      { path: 'forgotten', measure: undefined },
    ]);
  });
});

describe('measureFromMatches', () => {
  it('takes the deepest declared measure', () => {
    const measure = measureFromMatches([
      { handle: pageMeasure('working') },
      { handle: pageMeasure('full') },
    ]);

    expect(measure).toBe('full');
  });

  it('looks past matches that declare nothing', () => {
    const measure = measureFromMatches([{ handle: pageMeasure('reading') }, {}, { handle: {} }]);

    expect(measure).toBe('reading');
  });

  it('falls back to working when nothing declares one', () => {
    expect(measureFromMatches([{}, {}])).toBe('working');
  });
});
