import { isApiError, useConfirmGroupInvitationMutation } from '@sector/api-client';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@sector/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AuthPageLayout } from './auth-page-layout';
import { useAuth } from './auth-context';
import { classifyConfirmInvitationError, validateInvitationForm } from './invitation-model';

/**
 * `/group-invitation-confirmation?token=...` — the link every invitation
 * email sends (see `mail.groupInvitation` / `mail.onboardUser` call sites in
 * `group-member.controller.ts`, both of which build this exact path).
 *
 * The token is a JWT carrying only `{ userId, groupMemberId, action }`. There
 * is no unauthenticated route that resolves it to a group name or an
 * inviter, so this page cannot say which group is inviting the visitor —
 * only that one is. Inventing a lookup endpoint for that would be adding
 * server surface this phase does not own.
 */
export function InvitationLandingPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const confirmInvitation = useConfirmGroupInvitationMutation();
  const { status: authStatus, signOut } = auth;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);

  // A session already in this browser must go before the invitation can be
  // confirmed — the legacy landing page cleared localStorage outright; this
  // one goes through the auth context so drafts get purged too. Depends on
  // `authStatus` rather than running once on mount so it still fires once a
  // boot-time restore (`status: 'restoring'`) settles.
  useEffect(() => {
    if (authStatus === 'authenticated') signOut();
  }, [authStatus, signOut]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!token) {
      setFormError(t('invitation.missingToken'));
      return;
    }

    const result = validateInvitationForm({ password, confirmPassword });
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});

    try {
      await confirmInvitation.mutateAsync({ token, password: result.value.password });
      navigate('/login', { replace: true, state: { notice: t('invitation.successNotice') } });
    } catch (submitError) {
      if (
        classifyConfirmInvitationError(submitError) === 'serverMessage' &&
        isApiError(submitError)
      ) {
        setFormError(submitError.message);
      } else {
        setFormError(t('invitation.networkError'));
      }
    }
  }

  return (
    <AuthPageLayout>
      <Card>
        <CardHeader>
          <CardTitle>{t('invitation.title')}</CardTitle>
          <CardDescription>{t('invitation.description')}</CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="flex flex-col gap-3"
            aria-busy={confirmInvitation.isPending}
            noValidate
          >
            <Input
              label={t('invitation.passwordLabel')}
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
              label={t('invitation.confirmPasswordLabel')}
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
              disabled={confirmInvitation.isPending}
              className="mt-1 w-full"
            >
              {confirmInvitation.isPending
                ? t('invitation.confirming')
                : t('invitation.confirmButton')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthPageLayout>
  );
}
