import { Skeleton } from '@scanvault/ui';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v6';
import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useTranslation } from 'react-i18next';

import { shellTitleKeyFor } from './nav-config';
import { NavList } from './nav-list';
import { Sidebar } from './sidebar';
import { MOBILE_NAV_ID, SHELL_HEADING_ID, Topbar } from './topbar';
import { useNavBadges } from './use-nav-badges';

/** Shown while a lazily-loaded tab route fetches its chunk. */
function RouteFallback() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-3 h-9 w-full" />
      <Skeleton className="mt-2 h-64 w-full" />
    </div>
  );
}

/**
 * The authenticated chrome.
 *
 * Left rail and topbar share one unbroken parchment (--bg) field with no
 * divider between them; the content panel is the only inset surface, so its
 * top-left corner is the single rounded join in the frame. Nothing else draws
 * a box.
 *
 * Landmarks: a skip link to #main-content, <nav aria-label="Primary">, the
 * topbar's <header>, and <main> labelled by the topbar's <h1>.
 */
export function AppShell() {
  const location = useLocation();
  const badges = useNavBadges();
  const { t } = useTranslation();
  const [navOpen, setNavOpen] = useState(false);

  // A navigation from the mobile panel must close it; NavList's onNavigate
  // covers link clicks, this covers back/forward and programmatic redirects.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const title = t(shellTitleKeyFor(location.pathname));

  return (
    // nuqs needs router context, so the adapter lives inside a route element
    // rather than around <RouterProvider>. Every URL-state hook in the tabs
    // resolves from here.
    <NuqsAdapter>
      <div className="relative flex min-h-dvh bg-bg text-ink">
        {/*
          First tab stop on every page. It is parked above the viewport and
          moved in with plain `top` rather than the usual sr-only /
          focus:not-sr-only pair: `top` is a single property, so the focus
          variant wins on specificity with nothing to un-clip, and the link
          keeps real dimensions the whole time.
        */}
        <a
          href="#main-content"
          className="absolute left-3 -top-16 z-50 rounded-token border border-line bg-surface px-3 py-2 text-body font-medium text-ink transition-[top] focus:top-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink motion-reduce:transition-none"
        >
          Skip to main content
        </a>

        <Sidebar badges={badges} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar title={title} navOpen={navOpen} onToggleNav={() => setNavOpen((open) => !open)} />

          {navOpen ? (
            <nav
              id={MOBILE_NAV_ID}
              aria-label="Primary"
              className="border-b border-line px-3 pb-4 lg:hidden"
            >
              <NavList badges={badges} onNavigate={() => setNavOpen(false)} />
            </nav>
          ) : null}

          <main
            id="main-content"
            // Focusable so the skip link actually moves the caret, without
            // putting the panel in the tab order.
            tabIndex={-1}
            aria-labelledby={SHELL_HEADING_ID}
            className="min-w-0 flex-1 rounded-t-2xl border-l border-t border-line bg-surface px-4 py-5 outline-none lg:rounded-tr-none lg:px-6"
          >
            <div className="mx-auto w-full max-w-[1400px]">
              <Suspense fallback={<RouteFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </NuqsAdapter>
  );
}
