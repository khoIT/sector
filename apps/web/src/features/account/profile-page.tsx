import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sector/ui';
import { useTranslation } from 'react-i18next';

import { AssignmentReminderSetting } from './assignment-reminder-setting';
import { CreateScanFlowSetting } from './create-scan-flow-setting';
import { DeleteAccountDialog } from './delete-account-dialog';
import { NotificationPreferences } from './notification-preferences';
import { PasswordForm } from './password-form';
import { ProfileIdentityForm } from './profile-identity-form';
import { ProfilePhoto } from './profile-photo';

/**
 * The page behind the account menu's Profile link.
 *
 * Deliberately not the legacy profile editor. That one has six sections —
 * personal info, professional identity, licensing, facility, device and
 * experience, funding — against a `userprofiles` collection holding **zero
 * documents for 3,151 users**. Nobody has ever filled one in, so building the
 * editor for it would be speculation, and in a scan vault it would be
 * speculation about a course-side concern.
 *
 * What is here is the part backed by real fields on the users collection:
 * name, photo and password.
 */
export function ProfilePage() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="profile-heading" className="flex flex-col gap-5">
      <h2 id="profile-heading" className="text-[17px] font-semibold tracking-tight text-ink">
        {t('account.profile')}
      </h2>

      <Card>
        <CardHeader>
          <CardTitle>{t('account.identity.title')}</CardTitle>
          <CardDescription>{t('account.identity.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ProfilePhoto />
          <ProfileIdentityForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('account.createScanFlow.cardTitle')}</CardTitle>
          <CardDescription>{t('account.createScanFlow.cardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateScanFlowSetting />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('account.password.title')}</CardTitle>
          <CardDescription>{t('account.password.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <AssignmentReminderSetting />

      <NotificationPreferences />

      <Card>
        <CardHeader>
          <CardTitle>{t('deleteAccount.trigger')}</CardTitle>
          <CardDescription>{t('deleteAccount.cardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </section>
  );
}
