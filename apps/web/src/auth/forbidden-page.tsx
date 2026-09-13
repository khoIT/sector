import { Button, EmptyState } from '@sector/ui';
import { ShieldOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from './auth-context';

export type ForbiddenPageProps = {
  /** Permissions the route demanded. Shown so support can act on a report. */
  required?: readonly string[];
};

/**
 * 403. The legacy dashboard had no client-side guard on the scan detail routes
 * at all: a learner who followed a reviewer's link got the shell, an empty
 * table and a silent 403 in the network tab. Every guarded route in this app
 * lands here instead, and the page names the permission that was missing so a
 * mis-assigned role is diagnosable without opening devtools.
 *
 * The server is still the authority — this only makes the denial legible.
 */
export function ForbiddenPage({ required = [] }: ForbiddenPageProps) {
  const { role, permissions } = useAuth();
  const navigate = useNavigate();

  const missing = required.filter((permission) => !permissions.includes(permission));

  return (
    <section aria-labelledby="forbidden-heading" className="mx-auto max-w-xl py-6">
      <h2 id="forbidden-heading" className="sr-only">
        Access denied
      </h2>

      <EmptyState
        tone="crit"
        icon={<ShieldOff className="h-5 w-5" aria-hidden />}
        title="You do not have access to this page"
        description={
          role
            ? `The ${role.name} role is missing the permission this page requires.`
            : 'Your role is missing the permission this page requires.'
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Go back
            </Button>
            <Button asChild>
              <Link to="/">Back to the vault</Link>
            </Button>
          </div>
        }
      />

      {missing.length > 0 ? (
        <p className="mt-3 text-center text-body text-ink-dim">
          Missing{' '}
          {missing.map((permission, index) => (
            <span key={permission}>
              {index > 0 ? ', ' : null}
              <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[12px] text-ink">
                {permission}
              </code>
            </span>
          ))}
          {/* In an expression, so JSX does not insert a space before the stop. */}
          {'. Ask a group administrator to update your role.'}
        </p>
      ) : null}
    </section>
  );
}
