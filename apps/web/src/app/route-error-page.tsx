import { isApiError } from '@sector/api-client';
import { Button, EmptyState } from '@sector/ui';
import { TriangleAlert } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

/**
 * Last line of defence for a route subtree: a render crash, or a lazy chunk
 * that fails to load after a redeploy. Without it React Router unmounts the
 * tree and the user gets a white page with the error only in the console.
 */
export function RouteErrorPage() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : isApiError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : 'An unexpected error occurred.';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <EmptyState
        tone="crit"
        className="max-w-md"
        icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
        title="Something went wrong"
        description={message}
        action={
          // A full reload, not navigate(): the most common cause is a stale
          // chunk reference, which only a fresh document fixes.
          <Button onClick={() => window.location.assign('/')}>Reload Sector</Button>
        }
      />
    </main>
  );
}
