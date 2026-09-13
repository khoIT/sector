import { isApiError } from '@sector/api-client';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@sector/ui';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { AuthPageLayout } from './auth-page-layout';
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [userEmail, setUserEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = returnPathFrom(location.search);
  // Set by the reset-password and invitation pages via `navigate(..., {
  // state })` rather than a query string: it is a one-time notice, not part
  // of the URL a bookmark or a reload should keep re-showing.
  const notice = (location.state as { notice?: string } | null)?.notice ?? null;

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
        setFormError(error.statusCode === 429 ? t('auth.rateLimited') : error.message);
        setFieldErrors(error.fieldErrors());
      } else {
        setFormError(t('auth.networkError'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageLayout>
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.signInTitle')}</CardTitle>
        </CardHeader>

        <CardContent>
          {notice ? (
            <p
              role="status"
              className="mb-3 rounded-token border border-ok/25 bg-ok-soft px-3 py-2 text-body text-ok"
            >
              {notice}
            </p>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3"
            aria-busy={submitting}
            noValidate
          >
            <Input
              label={t('auth.usernameOrEmailLabel')}
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
              label={t('auth.passwordLabel')}
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
              {submitting ? t('auth.signingIn') : t('auth.signIn')}
            </Button>

            <Link
              to="/forgot-password"
              className="text-center text-body text-accent-ink hover:underline"
            >
              {t('auth.forgotPasswordLink')}
            </Link>
          </form>
        </CardContent>
      </Card>
    </AuthPageLayout>
  );
}
