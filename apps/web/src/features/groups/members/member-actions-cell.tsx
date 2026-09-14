import {
  useReInviteGroupMemberMutation,
  useRemoveGroupMemberMutation,
  useUpdateGroupMemberRoleMutation,
  type GroupMember,
  type GroupMemberRoleValue,
} from '@sector/api-client';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sector/ui';
import { MailPlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { errorMessage } from '@/lib/error-message';

import { ConfirmActionDialog } from '../confirm-action-dialog';
import {
  canResendInvitation,
  memberLabel,
  roleChangeIsRedundant,
  roleChangePayloadFor,
} from './member-actions-model';

/**
 * Per-row role change, re-invite and removal, gated on the real permission
 * rather than on `MembersViewerRole` — see the doc comment on
 * `memberColumnsFor` in `columns.ts` for why both a leader and an
 * administrator reach this, not just one.
 *
 * Both writes here change who can see a group's scans and courses, so both
 * confirm first, through the shared `ConfirmActionDialog`. A role change used
 * to fire straight out of `onValueChange`: one mis-click in a roster that runs
 * to 719 rows promoted a learner to leader, which is a permission grant, and
 * a failure showed nothing at all because only the removal's error was ever
 * rendered.
 */
export function MemberActionsCell({
  member,
  groupId,
  canEditRole,
  canRemove,
  canInvite,
}: {
  member: GroupMember;
  groupId: string;
  canEditRole: boolean;
  canRemove: boolean;
  canInvite: boolean;
}) {
  const { t } = useTranslation();
  const updateRole = useUpdateGroupMemberRoleMutation(groupId);
  const removeMember = useRemoveGroupMemberMutation(groupId);
  const reInvite = useReInviteGroupMemberMutation();

  const [pendingRole, setPendingRole] = useState<GroupMemberRoleValue | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const showResend = canInvite && canResendInvitation(member);
  if (!canEditRole && !canRemove && !showResend) return null;

  const name = memberLabel(member);

  function requestRoleChange(role: GroupMemberRoleValue) {
    if (roleChangeIsRedundant(member, role)) return;
    updateRole.reset();
    setPendingRole(role);
  }

  function closeRoleDialog(open: boolean) {
    if (!open) {
      setPendingRole(null);
      updateRole.reset();
    }
  }

  async function applyRoleChange() {
    if (!pendingRole) return;
    try {
      await updateRole.mutateAsync({
        groupMemberId: member.id,
        payload: roleChangePayloadFor(member, pendingRole),
      });
      setPendingRole(null);
    } catch {
      // Held open; rendered from updateRole.error inside the dialog.
    }
  }

  function closeRemoveDialog(open: boolean) {
    setConfirmRemove(open);
    if (!open) removeMember.reset();
  }

  async function applyRemove() {
    try {
      await removeMember.mutateAsync(member.id);
      setConfirmRemove(false);
    } catch {
      // Held open; rendered from removeMember.error inside the dialog.
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {canEditRole ? (
        <Select
          value={member.role}
          onValueChange={(value) => requestRoleChange(value as GroupMemberRoleValue)}
          disabled={updateRole.isPending}
        >
          <SelectTrigger
            className="h-8 w-28 text-[12px]"
            aria-label={t('groups.members.actions.changeRoleFor', { name })}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="leader">{t('groups.members.role.leader')}</SelectItem>
            <SelectItem value="learner">{t('groups.members.role.learner')}</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      {showResend ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('groups.members.actions.resendFor', { name })}
          disabled={reInvite.isPending}
          onClick={() => reInvite.mutate({ groupId, email: member.user.email })}
          title={
            reInvite.isSuccess
              ? t('groups.members.actions.resendSent')
              : t('groups.members.actions.resend')
          }
        >
          <MailPlus
            className={reInvite.isSuccess ? 'h-3.5 w-3.5 text-ok' : 'h-3.5 w-3.5'}
            aria-hidden
          />
        </Button>
      ) : null}

      {canRemove ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('groups.members.actions.removeFor', { name })}
          onClick={() => setConfirmRemove(true)}
        >
          <Trash2 className="h-3.5 w-3.5 text-crit" aria-hidden />
        </Button>
      ) : null}

      {/* Rendered outside the permission branches above so a dialog that is
          open when a re-render flips a permission still finishes its request
          rather than vanishing mid-flight. */}
      <ConfirmActionDialog
        open={pendingRole !== null}
        onOpenChange={closeRoleDialog}
        tone="primary"
        title={t('groups.members.actions.roleConfirmTitle')}
        description={
          <Trans
            i18nKey={
              pendingRole === 'leader'
                ? 'groups.members.actions.roleConfirmToLeader'
                : 'groups.members.actions.roleConfirmToLearner'
            }
            values={{ name }}
            components={{ strong: <strong className="font-semibold text-ink" /> }}
          />
        }
        error={
          updateRole.isError
            ? errorMessage(updateRole.error, t('groups.members.actions.roleError'))
            : undefined
        }
        isPending={updateRole.isPending}
        pendingLabel={t('groups.members.actions.roleSaving')}
        confirmLabel={t('groups.members.actions.roleConfirm')}
        onConfirm={() => void applyRoleChange()}
      />

      <ConfirmActionDialog
        open={confirmRemove}
        onOpenChange={closeRemoveDialog}
        title={t('groups.members.actions.removeConfirmTitle')}
        description={
          <Trans
            i18nKey="groups.members.actions.removeConfirmDescription"
            values={{ name }}
            components={{ strong: <strong className="font-semibold text-ink" /> }}
          />
        }
        error={
          removeMember.isError
            ? errorMessage(removeMember.error, t('groups.members.actions.removeError'))
            : undefined
        }
        isPending={removeMember.isPending}
        pendingLabel={t('groups.members.actions.removing')}
        confirmLabel={t('groups.members.actions.remove')}
        onConfirm={() => void applyRemove()}
      />

      {reInvite.isError ? (
        <span className="text-[12px] text-crit">
          {errorMessage(reInvite.error, t('groups.members.actions.resendError'))}
        </span>
      ) : null}
    </div>
  );
}
