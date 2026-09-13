import {
  isApiError,
  useAddExistingUserToGroupMutation,
  useInviteGroupMemberMutation,
  type GroupMemberRoleValue,
} from '@sector/api-client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sector/ui';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AccountField, FormNotice } from '@/features/account/account-form-parts';

/**
 * Invite a member by email. `POST /api/group-members/invite` 400s with
 * `details.code === 'USER_ALREADY_EXISTS'` when the email already belongs to
 * an active account (`group-member.controller.ts#inviteGroupMember`) — the
 * server's own message asks whether to add them directly instead, so this
 * dialog offers exactly that as a second step rather than a dead end.
 */
export function InviteMemberDialog({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const invite = useInviteGroupMemberMutation(groupId);
  const addExisting = useAddExistingUserToGroupMutation(groupId);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<GroupMemberRoleValue>('learner');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [succeeded, setSucceeded] = useState(false);

  const alreadyExists =
    isApiError(invite.error) &&
    (invite.error.details as { code?: string } | null)?.code === 'USER_ALREADY_EXISTS';

  function handleOpenChange(next: boolean) {
    if (invite.isPending || addExisting.isPending) return;
    setOpen(next);
    if (!next) {
      setEmail('');
      setFirstName('');
      setLastName('');
      setRole('learner');
      setEmailError(undefined);
      setSucceeded(false);
      invite.reset();
      addExisting.reset();
    }
  }

  async function submitInvite() {
    setEmailError(undefined);
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(t('groups.invite.emailInvalid'));
      return;
    }

    try {
      await invite.mutateAsync({
        groupId,
        email: trimmed,
        role,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      setSucceeded(true);
    } catch {
      // Rendered from invite.error below — including the USER_ALREADY_EXISTS case.
    }
  }

  async function submitAddExisting() {
    try {
      await addExisting.mutateAsync({ groupId, emailUserName: email.trim(), role });
      setSucceeded(true);
    } catch {
      // Rendered from addExisting.error below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" onClick={() => setOpen(true)}>
          <UserPlus className="h-3.5 w-3.5" aria-hidden />
          {t('groups.invite.trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('groups.invite.title')}</DialogTitle>
          <DialogDescription>{t('groups.invite.description')}</DialogDescription>
        </DialogHeader>

        {succeeded ? (
          <FormNotice tone="ok">{t('groups.invite.success')}</FormNotice>
        ) : (
          <div className="flex flex-col gap-3">
            <AccountField
              label={t('groups.invite.emailLabel')}
              htmlFor="invite-email"
              error={emailError}
            >
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="off"
              />
            </AccountField>

            <div className="grid grid-cols-2 gap-3">
              <AccountField label={t('groups.invite.firstNameLabel')} htmlFor="invite-first-name">
                <Input
                  id="invite-first-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </AccountField>
              <AccountField label={t('groups.invite.lastNameLabel')} htmlFor="invite-last-name">
                <Input
                  id="invite-last-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </AccountField>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-body font-medium text-ink">{t('groups.invite.roleLabel')}</span>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as GroupMemberRoleValue)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="learner">{t('groups.members.role.learner')}</SelectItem>
                  <SelectItem value="leader">{t('groups.members.role.leader')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {invite.isError && !alreadyExists ? (
              <FormNotice tone="crit">
                {isApiError(invite.error) ? invite.error.message : t('groups.invite.error')}
              </FormNotice>
            ) : null}

            {alreadyExists ? (
              <FormNotice tone="crit">
                {t('groups.invite.alreadyExists')}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="ml-2"
                  disabled={addExisting.isPending}
                  onClick={() => void submitAddExisting()}
                >
                  {addExisting.isPending
                    ? t('groups.invite.addingExisting')
                    : t('groups.invite.addExisting')}
                </Button>
              </FormNotice>
            ) : null}

            {addExisting.isError ? (
              <FormNotice tone="crit">
                {isApiError(addExisting.error)
                  ? addExisting.error.message
                  : t('groups.invite.error')}
              </FormNotice>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => handleOpenChange(false)}>
            {succeeded ? t('actions.close') : t('actions.cancel')}
          </Button>
          {succeeded ? null : (
            <Button
              size="sm"
              disabled={invite.isPending || addExisting.isPending}
              onClick={() => void submitInvite()}
            >
              {invite.isPending ? t('groups.invite.sending') : t('groups.invite.submit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
