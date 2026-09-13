import {
  useSendPasswordResetOtpMutation,
  useVerifyPasswordResetOtpMutation,
} from '@sector/api-client';
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
  buildResetPath,
  classifyAuthRequestError,
  classifySendOtpError,
  parseRecoveryQuery,
  readStoredRecoveryToken,
  writeStoredRecoveryToken,
} from './password-recovery-model';

/**
 * Step 2 of 3: "check your email" plus the code entry, at
 * `/forgot-password/verify`. The heading is the SAME regardless of whether
 * step 1 found a real account — the non-disclosure decision was already made
 * on the previous page; this one only has to not contradict it.
 *
 * The primary token this step needs comes from one of two places: this
 * app's own step 1, which leaves it in sessionStorage rather than the URL
 * (see `readStoredRecoveryToken`), or an emailed link
 * (`admin-reset-password-otp.eta`), which carries it as `?q=` on the URL
 * itself — `parseRecoveryQuery` already resolves that alias. The URL value
 * wins when both are somehow present.
 *
 * A wrong or expired code answers the server's own generic message
 * (`OTP_COMMON_ERROR_MESSAGE`), which this page re-states in its own copy
 * rather than passing the raw string through, so wording stays consistent
 * with the rest of the flow and stays translated.
 */
export function ResetSentPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { token: urlToken, email } = parseRecoveryQuery(location.search);

  const verifyOtp = useVerifyPasswordResetOtpMutation();
  const resendOtp = useSendPasswordResetOtpMutation();

  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResendNotice(null);

    const token = urlToken ?? readStoredRecoveryToken(window.sessionStorage);

    try {
      const result = await verifyOtp.mutateAsync({ token: token ?? '', otpCode });
      // Spent — clear it so a stale value cannot leak into a later attempt.
      writeStoredRecoveryToken(window.sessionStorage, null);
      navigate(buildResetPath(result.token));
    } catch (submitError) {
      switch (classifyAuthRequestError(submitError)) {
        case 'serverMessage':
          setError(t('recovery.invalidCode'));
          return;
        case 'rateLimited':
          setError(t('recovery.rateLimited'));
          return;
        case 'network':
          setError(t('recovery.networkError'));
      }
    }
  }

  async function handleResend() {
    if (!email) return;
    setError(null);
    setResendNotice(null);

    // The URL never changes on resend — only `email` was ever in it — so the
    // new token, or its deliberate absence, goes to the same sessionStorage
    // slot rather than anywhere a reload or a shared screen could show it.
    try {
      const result = await resendOtp.mutateAsync({ email });
      writeStoredRecoveryToken(window.sessionStorage, result.token);
      setResendNotice(t('recovery.resendSent'));
    } catch (submitError) {
      switch (classifySendOtpError(submitError)) {
        case 'proceed':
          writeStoredRecoveryToken(window.sessionStorage, null);
          setResendNotice(t('recovery.resendSent'));
          return;
        case 'rateLimited':
          setError(t('recovery.rateLimited'));
          return;
        case 'network':
          setError(t('recovery.networkError'));
      }
    }
  }

  // Reached with no email at all — there is nothing to verify or resend, and
  // showing an OTP box with no way to fill it in honestly is worse than
  // sending the visitor back to start.
  if (!email) {
    return (
      <AuthPageLayout>
        <Card>
          <CardHeader>
            <CardTitle>{t('recovery.sentTitle')}</CardTitle>
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

  return (
    <AuthPageLayout>
      <Card>
        <CardHeader>
          <CardTitle>{t('recovery.sentTitle')}</CardTitle>
          <CardDescription>{t('recovery.sentDescription')}</CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={(event) => void handleVerify(event)}
            className="flex flex-col gap-3"
            aria-busy={verifyOtp.isPending}
            noValidate
          >
            <Input
              label={t('recovery.codeLabel')}
              name="otpCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              required
            />

            {error ? (
              <p
                role="alert"
                className="rounded-token bg-crit-soft px-2.5 py-2 text-body text-crit"
              >
                {error}
              </p>
            ) : null}

            {resendNotice ? (
              <p
                role="status"
                className="rounded-token border border-ok/25 bg-ok-soft px-3 py-2 text-body text-ok"
              >
                {resendNotice}
              </p>
            ) : null}

            <Button type="submit" size="lg" disabled={verifyOtp.isPending} className="mt-1 w-full">
              {verifyOtp.isPending ? t('recovery.verifying') : t('recovery.verify')}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={resendOtp.isPending}
              onClick={() => void handleResend()}
            >
              {resendOtp.isPending ? t('recovery.resending') : t('recovery.resendCode')}
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
