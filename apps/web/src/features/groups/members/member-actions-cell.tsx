import {
  isApiError,
  useRemoveGroupMemberMutation,
  useUpdateGroupMemberRoleMutation,
  type GroupMember,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sector/ui';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Per-row role change and removal, gated on the real permission rather than
 * on `MembersViewerRole` — see the doc comment on `memberColumnsFor` in
 * `columns.ts` for why both a leader and an administrator reach this, not
 * just one.
 */
export function MemberActionsCell({
  member,
  groupId,
  canEditRole,
  canRemove,
}: {
  member: GroupMember;
  groupId: string;
  canEditRole: boolean;
  canRemove: boolean;
}) {
  const { t } = useTranslation();
  const updateRole = useUpdateGroupMemberRoleMutation(groupId);
  const removeMember = useRemoveGroupMemberMutation(groupId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!canEditRole && !canRemove) return null;

  function changeRole(role: GroupMemberRoleValue) {
    if (role === member.role) return;
    updateRole.mutate({ groupMemberId: member.id, payload: { role } });
  }

  async function confirmRemove() {
    try {
      await removeMember.mutateAsync(member.id);
      setConfirmOpen(false);
    } catch {
      // Rendered from removeMember.error below.
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {canEditRole ? (
        <Select
          value={member.role}
          onValueChange={(value) => changeRole(value as GroupMemberRoleValue)}
          disabled={updateRole.isPending}
        >
          <SelectTrigger
            className="h-8 w-28 text-[12px]"
            aria-label={t('groups.members.actions.changeRole')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="leader">{t('groups.members.role.leader')}</SelectItem>
            <SelectItem value="learner">{t('groups.members.role.learner')}</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      {canRemove ? (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('groups.members.actions.remove')}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 text-crit" aria-hidden />
          </Button>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('groups.members.actions.removeConfirmTitle')}</DialogTitle>
              <DialogDescription>
                {t('groups.members.actions.removeConfirmDescription')}
              </DialogDescription>
            </DialogHeader>

            {removeMember.isError ? (
              <p className="text-[12px] text-crit">
                {isApiError(removeMember.error)
                  ? removeMember.error.message
                  : t('groups.members.actions.removeError')}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                variant="secondary"
                size="sm"
                disabled={removeMember.isPending}
                onClick={() => setConfirmOpen(false)}
              >
                {t('actions.cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={removeMember.isPending}
                onClick={() => void confirmRemove()}
              >
                {removeMember.isPending
                  ? t('groups.members.actions.removing')
                  : t('groups.members.actions.remove')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
