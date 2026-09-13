import { useResetPasswordMutation } from '@sector/api-client';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@sector/ui';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { AuthPageLayout } from './auth-page-layout';
import {
  classifyAuthRequestError,
  parseRecoveryQuery,
  validateResetPassword,
} from './password-recovery-model';

/**
 * Step 3 of 3: `POST /api/forgot-password/reset`, at `/forgot-password/reset`.
 *
 * On success there is nothing left to authenticate with here — the secondary
 * token is spent and the server rotated nothing to replace it — so this sends
 * the visitor to `/login` with a one-time notice rather than trying to sign
 * them in directly.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = parseRecoveryQuery(location.search);

  const resetPassword = useResetPasswordMutation();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthPageLayout>
        <Card>
          <CardHeader>
            <CardTitle>{t('recovery.resetTitle')}</CardTitle>
            <CardDescription>{t('recovery.missingFlow')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full">
              <Link to="/forgot-password">{t('recovery.startOver')}</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthPageLayout>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const result = validateResetPassword({ token, password, confirmPassword });
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});

    try {
      await resetPassword.mutateAsync(result.value);
      navigate('/login', { replace: true, state: { notice: t('recovery.successNotice') } });
    } catch (submitError) {
      switch (classifyAuthRequestError(submitError)) {
        case 'serverMessage':
          setFormError(t('recovery.resetError'));
          return;
        case 'rateLimited':
          setFormError(t('recovery.rateLimited'));
          return;
        case 'network':
          setFormError(t('recovery.networkError'));
      }
    }
  }

  return (
    <AuthPageLayout>
      <Card>
        <CardHeader>
          <CardTitle>{t('recovery.resetTitle')}</CardTitle>
          <CardDescription>{t('recovery.resetDescription')}</CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="flex flex-col gap-3"
            aria-busy={resetPassword.isPending}
            noValidate
          >
            <Input
              label={t('recovery.newPasswordLabel')}
              name="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldErrors.password}
              required
            />

            <Input
              label={t('recovery.confirmPasswordLabel')}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              error={fieldErrors.confirmPassword}
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

            <Button
              type="submit"
              size="lg"
              disabled={resetPassword.isPending}
              className="mt-1 w-full"
            >
              {resetPassword.isPending ? t('recovery.resetting') : t('recovery.resetButton')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthPageLayout>
  );
}
