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
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

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
 * only that one is. Inventing a lookup endpoint for that would mean adding a
 * new server route just to answer this page, which is out of scope here.
 */
export function InvitationLandingPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const confirmInvitation = useConfirmGroupInvitationMutation();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);

  // Reached with no token at all — there is nothing to confirm, and the
  // stale-or-mistyped-link message belongs up front rather than waiting for
  // a submit the visitor has no reason to expect will fail.
  if (!token) {
    return (
      <AuthPageLayout>
        <Card>
          <CardHeader>
            <CardTitle>{t('invitation.title')}</CardTitle>
            <CardDescription>{t('invitation.missingToken')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full">
              <Link to="/login">{t('recovery.backToLogin')}</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthPageLayout>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // Unreachable in practice — the early return above already sends a
    // visitor with no token to the missing-token card before this form ever
    // renders — but `token` is captured by this closure, and TypeScript does
    // not carry a control-flow narrowing across a nested function boundary.
    if (!token) return;

    const result = validateInvitationForm({ password, confirmPassword });
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});

    // A session already in this browser must go before the invitation is
    // confirmed — otherwise it could attach to whoever last used this
    // machine rather than the person clicking the emailed link. Done here,
    // immediately before the request, rather than on mount: signOut also
    // purges the current draft's files (auth-context signOut ->
    // clearDraftFiles), and a stale or mistyped link with no token should
    // not cost an unrelated visitor their in-progress upload just for
    // loading this page.
    if (auth.status === 'authenticated') auth.signOut();

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
