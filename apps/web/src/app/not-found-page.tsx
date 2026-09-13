import { Button, EmptyState } from '@sector/ui';
import { FileQuestion } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

/** 404, rendered inside the shell so the nav stays usable. */
export function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <section aria-labelledby="not-found-heading">
      <h2 id="not-found-heading" className="sr-only">
        Page not found
      </h2>

      <EmptyState
        icon={<FileQuestion className="h-5 w-5" aria-hidden />}
        title="Page not found"
        description={`Nothing in Sector is routed at ${pathname}.`}
        action={
          <Button asChild>
            <Link to="/">Back to the vault</Link>
          </Button>
        }
      />
    </section>
  );
}
