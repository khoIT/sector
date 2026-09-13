import { useSendPasswordResetOtpMutation } from '@sector/api-client';
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
import { Link, useNavigate } from 'react-router-dom';

import { AuthPageLayout } from './auth-page-layout';
import {
  buildVerifyPath,
  classifySendOtpError,
  validateForgotPasswordEmail,
  writeStoredRecoveryToken,
} from './password-recovery-model';

/**
 * Step 1 of 3: `POST /api/forgot-password/send-otp`.
 *
 * On success OR on the server's 400 "Email not found", this moves to the
 * verify step with IDENTICAL wording either way — see
 * `classifySendOtpError`. Whether the typed address belongs to an account is
 * never observable from here. Only the shared auth rate limit (429) and an
 * actual network failure are shown as themselves.
 *
 * The address is validated client-side FIRST: a malformed one (`me@gusi`)
 * would otherwise reach the server, get the same 400 "Email not found" a
 * real-but-unknown address gets, and land the visitor on "check your email"
 * for an address that could never have received anything. A validation
 * error is not a disclosure — it says nothing about any specific address.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sendOtp = useSendPasswordResetOtpMutation();

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);
    setFormError(null);

    const validated = validateForgotPasswordEmail({ email });
    if (!validated.ok) {
      setFieldError(validated.error);
      return;
    }

    try {
      const result = await sendOtp.mutateAsync(validated.value);
      writeStoredRecoveryToken(window.sessionStorage, result.token);
      navigate(buildVerifyPath(validated.value.email));
    } catch (submitError) {
      switch (classifySendOtpError(submitError)) {
        case 'proceed':
          writeStoredRecoveryToken(window.sessionStorage, null);
          navigate(buildVerifyPath(validated.value.email));
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
          <CardTitle>{t('recovery.forgotTitle')}</CardTitle>
          <CardDescription>{t('recovery.forgotDescription')}</CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="flex flex-col gap-3"
            aria-busy={sendOtp.isPending}
            noValidate
          >
            <Input
              label={t('recovery.emailLabel')}
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldError ?? undefined}
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

            <Button type="submit" size="lg" disabled={sendOtp.isPending} className="mt-1 w-full">
              {sendOtp.isPending ? t('recovery.sending') : t('recovery.sendCode')}
            </Button>

            <Link to="/login" className="text-center text-body text-accent-ink hover:underline">
              {t('recovery.backToLogin')}
            </Link>
          </form>
        </CardContent>
      </Card>
    </AuthPageLayout>
  );
}
