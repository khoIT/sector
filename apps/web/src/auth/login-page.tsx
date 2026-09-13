import { isApiError } from '@sector/api-client';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@sector/ui';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { SectorMark } from '@/shell/sector-mark';
import { ThemeSwitcher } from '@/shell/theme-switcher';

import { useAuth } from './auth-context';
import { returnPathFrom } from './safe-redirect';

/**
 * POST /api/login.
 *
 * The credential field is `userEmail` and accepts EITHER a username or an
 * email address — the label says so, because "Email" alone made the legacy
 * form look broken for the accounts that sign in with a username. The legacy
 * form also sent an `eulaAgreement` flag; the server ignores it, so it is gone.
 */
export function LoginPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [userEmail, setUserEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = returnPathFrom(location.search);

  if (status === 'authenticated') return <Navigate to={redirectTo} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      await signIn({ userEmail, password });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (isApiError(error)) {
        // Auth routes are rate limited to 20 requests per 15 minutes per IP,
        // and the 429 body reads like a generic failure. Say what it is.
        setFormError(
          error.statusCode === 429
            ? 'Too many sign-in attempts. Wait a few minutes and try again.'
            : error.message,
        );
        setFieldErrors(error.fieldErrors());
      } else {
        setFormError('Could not reach the server. Is the API running on :5001?');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <SectorMark size={36} />
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-ink">Sector</h1>
            <p className="mt-0.5 text-body text-ink-dim">Global Ultrasound Institute</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3"
              aria-busy={submitting}
              noValidate
            >
              <Input
                label="Username or email"
                name="userEmail"
                type="text"
                autoComplete="username"
                autoFocus
                value={userEmail}
                onChange={(event) => setUserEmail(event.target.value)}
                error={fieldErrors.userEmail}
                required
              />

              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={fieldErrors.password}
                required
              />

              {formError ? (
                <p
                  role="alert"
                  className="rounded-token bg-crit-soft px-2.5 py-2 text-body text-crit"
                >
                  {formError}
                </p>
              ) : null}

              <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-center">
          <ThemeSwitcher />
        </div>
      </div>
    </main>
  );
}
