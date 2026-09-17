import type { PageMeasure } from '@sector/ui';
import type { RouteObject } from 'react-router-dom';

/**
 * How wide each route is allowed to be, declared on the route itself.
 *
 * The app shell used to cap every page at 1400px. One number for a paragraph
 * of prose and for a table of 1,477 groups is wrong for both, and no route
 * could say so. Now the shell applies no width at all and each route carries
 * its measure in React Router's `handle`.
 *
 * `handle` rather than a wrapper component inside each page, for two reasons
 * that only show up later:
 *
 *   - A page has more than one render branch. `course-landing-page.tsx`
 *     returns a skeleton, an error state and the page itself; a wrapper in the
 *     success branch leaves the other two unmeasured, and the loading state is
 *     exactly when a width mistake is most visible.
 *   - A wrapper in the component and a table in a test are two places that
 *     can disagree. Here `route-measures.test.ts` walks the same objects the
 *     router walks, so "every route declares a measure" is a fact about the
 *     routes and not a list someone has to remember to update.
 *
 * Nested routes inherit: the course shell declares `full` and its item child
 * says nothing, so the child is `full` too. The DEEPEST declaration wins, so a
 * child can still override its parent.
 */
export type RouteMeasureHandle = { measure?: PageMeasure };

/**
 * A route's measure, as a `handle`.
 *
 * `handle` is typed `any` by React Router, so a bare object literal would let
 * `{ measure: 'workign' }` through typecheck and fall back to `working`
 * forever without anyone noticing. This is the same literal with the typo
 * caught at the call site.
 */
export function pageMeasure(measure: PageMeasure): RouteMeasureHandle {
  return { measure };
}

/** The measure a matched route chain resolves to. Deepest declaration wins. */
export function measureFromMatches(
  matches: ReadonlyArray<{ handle?: unknown }>,
  fallback: PageMeasure = 'working',
): PageMeasure {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const measure = (matches[index]?.handle as RouteMeasureHandle | undefined)?.measure;
    if (measure) return measure;
  }
  return fallback;
}

export type RouteMeasureEntry = { path: string; measure: PageMeasure | undefined };

/**
 * Every leaf path in a route tree with the measure it resolves to, for the
 * test that stops a route shipping without one.
 *
 * Mirrors `leafPaths` in `feature-routes.test.ts` — same walk, same treatment
 * of pathless layout routes — but carries the inherited handle down with it.
 */
function declaredMeasure(route: RouteObject): PageMeasure | undefined {
  return (route.handle as RouteMeasureHandle | undefined)?.measure;
}

/**
 * The measure a parent's OWN path resolves to, by finding the index route the
 * router would render there.
 *
 * Searched through pathless children, not just direct ones. This codebase
 * wraps surfaces in a pathless `<RequirePermission>` layout route, so an index
 * child is regularly a grandchild; a one-level lookup reports the wrapper's
 * measure for a URL the router renders with the index child's, and a parent
 * that declares nothing reports `undefined` for a route that is in fact
 * declared — a false failure whose obvious "fix" is a redundant handle that
 * desynchronises this table from the router permanently.
 *
 * Routes WITH a path are not followed: they are different URLs, and their
 * index children answer for those, not for this one.
 */
function indexRouteMeasure(
  route: RouteObject,
  inherited: PageMeasure | undefined,
): { found: boolean; measure: PageMeasure | undefined } {
  for (const child of route.children ?? []) {
    const measure = declaredMeasure(child) ?? inherited;
    if (child.index) return { found: true, measure };
    if (!child.path) {
      const nested = indexRouteMeasure(child, measure);
      if (nested.found) return nested;
    }
  }
  return { found: false, measure: undefined };
}

/**
 * Join a parent prefix and a child path into the URL the router resolves.
 *
 * The duplicate-slash collapse is what lets the walk start at the real root
 * route (`path: '/'`) rather than at a list of its children — which is the
 * only way an index route mounted directly under the root is visible at all,
 * since an index route has no path of its own to be attributed to.
 */
function joinPath(prefix: string, path: string): string {
  return [prefix, path]
    .filter(Boolean)
    .join('/')
    .replace(/\/{2,}/g, '/');
}

export function routeMeasures(
  routes: readonly RouteObject[],
  prefix = '',
  inherited: PageMeasure | undefined = undefined,
): RouteMeasureEntry[] {
  return routes.flatMap((route) => {
    const here = route.path ? joinPath(prefix, route.path) : prefix;
    const measure = declaredMeasure(route) ?? inherited;
    const children = route.children ? routeMeasures(route.children, here, measure) : [];

    // Visiting a parent's own path renders its INDEX child, so that child's
    // measure is the one the parent path resolves to. An index route carries
    // no `path` of its own, so without this it would be invisible here while
    // being perfectly visible to the router — the course shell declares `full`
    // for the player and its index child takes `working` back for the outline,
    // and only the first of those would have been checked.
    const index = indexRouteMeasure(route, measure);
    const own = index.found ? index.measure : measure;

    // A pathless layout route contributes its children, not itself — but its
    // measure still flows down, which is how `RequirePermission` wrappers stay
    // free of layout concerns.
    return route.path ? [{ path: here, measure: own }, ...children] : children;
  });
}
