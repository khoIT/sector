import { isApiError } from '@scanvault/api-client';
import { Button, EmptyState } from '@scanvault/ui';
import { ShieldAlert, TriangleAlert } from 'lucide-react';

export type ListErrorStateProps = {
  error: unknown;
  onRetry: () => void;
};

/**
 * Request failures, told apart rather than lumped into "something went wrong".
 *
 * 403 is the interesting one on these routes: the TAB is gated on `view:…`
 * while the ROUTE is gated on `read:…`, so a role carrying only the view
 * permission gets a tab it cannot open. Saying so beats a generic retry
 * button the user can press forever.
 */
export function ListErrorState({ error, onRetry }: ListErrorStateProps) {
  if (isApiError(error) && error.isForbidden) {
    return (
      <EmptyState
        tone="crit"
        icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
        title="Your role cannot open this list"
        description="The tab is visible because your role can SEE this section, but the server also requires the matching read permission to return the rows. Ask a GUSI administrator to grant it."
      />
    );
  }

  const message = isApiError(error)
    ? error.message
    : 'Could not reach the server. Check that the API is running.';

  return (
    <EmptyState
      tone="crit"
      icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
      title="This list could not be loaded"
      description={message}
      action={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}
