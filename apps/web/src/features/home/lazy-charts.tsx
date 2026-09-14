import { Skeleton } from '@sector/ui';
import type { BarsProps, DonutProps, LineTrendProps, SparklineProps } from '@sector/ui/charts';
import { lazy, Suspense } from 'react';

/**
 * The chart primitives, loaded on demand.
 *
 * recharts plus its d3 dependencies are 566 kB raw / 160 kB gzipped — measured,
 * not estimated: building with those modules forced into their own chunk puts
 * them at 47% of the entry chunk. Home is the landing route and is imported
 * statically by the router, so while the charts came from the `@sector/ui`
 * root they were downloaded and parsed before first paint by every account,
 * including a learner whose home draws one donut and an administrator whose
 * home draws none.
 *
 * One dynamic `import('@sector/ui/charts')` specifier for all four, so the
 * bundler emits one chunk and the second card does not wait on a second
 * request. Each card keeps its own `Suspense` boundary and the same skeleton
 * it already shows while its query is in flight, so the fallback reads as the
 * card still loading rather than as a hole in the page.
 */
const loadCharts = () => import('@sector/ui/charts');

const DonutImpl = lazy(() => loadCharts().then((charts) => ({ default: charts.Donut })));
const BarsImpl = lazy(() => loadCharts().then((charts) => ({ default: charts.Bars })));
const LineTrendImpl = lazy(() => loadCharts().then((charts) => ({ default: charts.LineTrend })));
const SparklineImpl = lazy(() => loadCharts().then((charts) => ({ default: charts.Sparkline })));

export function Donut(props: DonutProps) {
  return (
    <Suspense fallback={<Skeleton className="h-[240px] w-full" />}>
      <DonutImpl {...props} />
    </Suspense>
  );
}

export function Bars(props: BarsProps) {
  // A literal class, not a template built from `props.height`: Tailwind
  // generates utilities by scanning source text, so an interpolated one would
  // simply not exist. Every caller here uses the default height.
  return (
    <Suspense fallback={<Skeleton className="h-[240px] w-full" />}>
      <BarsImpl {...props} />
    </Suspense>
  );
}

export function LineTrend(props: LineTrendProps) {
  return (
    <Suspense fallback={<Skeleton className="h-[220px] w-full" />}>
      <LineTrendImpl {...props} />
    </Suspense>
  );
}

/** Decorative and inline, so it fades in with no placeholder of its own. */
export function Sparkline(props: SparklineProps) {
  return (
    <Suspense fallback={null}>
      <SparklineImpl {...props} />
    </Suspense>
  );
}
