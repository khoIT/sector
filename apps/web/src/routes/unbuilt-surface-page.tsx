import { EmptyState } from '@sector/ui';
import { Construction } from 'lucide-react';

/**
 * What a section in the rail shows before its surface exists.
 *
 * One page for all of them, and it says the true thing: the route resolved,
 * and there is nothing behind it yet. No skeleton, no spinner and no sample
 * rows — a placeholder that imitates a loading page is a bug report waiting to
 * happen, and the legacy dashboard had two menu entries that opened on an
 * empty table with no explanation at all.
 *
 * It also rules out the other reading. A blank section looks exactly like a
 * section your role cannot see, so the copy says the permissions are not the
 * reason; a real denial renders auth/forbidden-page.tsx, which names the
 * missing permission instead.
 *
 * Imported directly rather than through lazy(): the whole page is one empty
 * state, so a separate chunk would cost a request to save a few hundred bytes.
 *
 * The <h1> is the topbar's, from the nav label for this URL, so the section
 * already names itself above this.
 */
export function UnbuiltSurfacePage() {
  return (
    <section aria-labelledby="unbuilt-surface-heading">
      <h2 id="unbuilt-surface-heading" className="sr-only">
        Not built yet
      </h2>

      <EmptyState
        icon={<Construction className="h-5 w-5" aria-hidden />}
        title="This section has not been built yet"
        description="The navigation entry and the route are real; the surface behind them is still to come. Nothing is hidden here by your role — there is nothing here yet."
      />
    </section>
  );
}
