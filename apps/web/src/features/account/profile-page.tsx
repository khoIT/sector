import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sector/ui';
import { useTranslation } from 'react-i18next';

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
    <section aria-labelledby="profile-heading" className="flex max-w-3xl flex-col gap-5">
      <h2 id="profile-heading" className="text-[17px] font-semibold tracking-tight text-ink">
        Profile
      </h2>

      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
          <CardDescription>
            The name and picture other people see beside your scans.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ProfilePhoto />
          <ProfileIdentityForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create scan study</CardTitle>
          <CardDescription>
            How the create-scan page is laid out for you. Both layouts collect the same things and
            share the same draft.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateScanFlowSetting />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>You will need your current password to set a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

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
