import {
  isApiError,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useUserOrganizations,
  type GroupWriteResult,
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
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';
import { AccountField, FormNotice } from '@/features/account/account-form-parts';

import { groupMembersPathFor } from '../groups-links';
import {
  draftFromGroup,
  EMPTY_GROUP_DRAFT,
  slugify,
  validateCreateGroup,
  validateUpdateGroup,
  type FieldErrors,
  type GroupField,
  type GroupFormDraft,
} from './group-form-model';

type GroupFormDialogProps = { mode: 'create' } | { mode: 'edit'; group: GroupWriteResult };

/**
 * Create and edit share ONE dialog, parameterised by mode rather than
 * forked into two components — same principle CONTRACTS.md and the members
 * surface apply to columns. `organization` is create-only (see the doc
 * comment on `updateGroupPayloadSchema`), and `slug` auto-follows `name`
 * until the user edits it directly.
 */
export function GroupFormDialog(props: GroupFormDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const createGroup = useCreateGroupMutation();
  const updateGroup = useUpdateGroupMutation();
  const organizations = useUserOrganizations(user?.id);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<GroupFormDraft>(() =>
    props.mode === 'edit' ? draftFromGroup(props.group) : EMPTY_GROUP_DRAFT,
  );
  const [errors, setErrors] = useState<FieldErrors<GroupField>>({});

  const mutation = props.mode === 'create' ? createGroup : updateGroup;
  const isEdit = props.mode === 'edit';

  function handleOpenChange(next: boolean) {
    if (mutation.isPending) return;
    setOpen(next);
    if (next) {
      setDraft(isEdit ? draftFromGroup(props.group) : EMPTY_GROUP_DRAFT);
      setErrors({});
      mutation.reset();
    }
  }

  function setName(name: string) {
    setDraft((prev) => ({
      ...prev,
      name,
      slug: prev.slugTouched ? prev.slug : slugify(name),
    }));
  }

  function setSlug(slug: string) {
    setDraft((prev) => ({ ...prev, slug, slugTouched: true }));
  }

  async function submit() {
    if (isEdit) {
      const result = validateUpdateGroup(draft);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setErrors({});
      try {
        await updateGroup.mutateAsync({ groupId: props.group.id, payload: result.value });
        setOpen(false);
      } catch {
        // Rendered from mutation.error below.
      }
      return;
    }

    const result = validateCreateGroup(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});

    try {
      const created = await createGroup.mutateAsync(result.value);
      setOpen(false);
      navigate(groupMembersPathFor(created.id), { state: { groupName: created.name } });
    } catch {
      // Rendered from mutation.error below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {t('groups.form.editTrigger')}
          </Button>
        ) : (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t('groups.form.createTrigger')}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('groups.form.editTitle') : t('groups.form.createTitle')}
          </DialogTitle>
          <DialogDescription>{t('groups.form.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <AccountField label={t('groups.form.nameLabel')} htmlFor="group-name" error={errors.name}>
            <Input
              id="group-name"
              value={draft.name}
              onChange={(event) => setName(event.target.value)}
            />
          </AccountField>

          <AccountField
            label={t('groups.form.slugLabel')}
            htmlFor="group-slug"
            error={errors.slug}
            hint={t('groups.form.slugHint')}
          >
            <Input
              id="group-slug"
              value={draft.slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </AccountField>

          {!isEdit ? (
            <AccountField
              label={t('groups.form.organizationLabel')}
              htmlFor="group-organization"
              error={errors.organization}
            >
              <Select
                value={draft.organization}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, organization: value }))}
              >
                <SelectTrigger
                  id="group-organization"
                  placeholder={t('groups.form.organizationPlaceholder')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(organizations.data ?? []).map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AccountField>
          ) : null}

          <AccountField label={t('groups.form.descriptionLabel')} htmlFor="group-description">
            <Input
              id="group-description"
              value={draft.description}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </AccountField>

          <AccountField label={t('groups.form.typeLabel')} htmlFor="group-type">
            <Select
              value={draft.type || undefined}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, type: value as GroupFormDraft['type'] }))
              }
            >
              <SelectTrigger id="group-type" placeholder={t('groups.form.typePlaceholder')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="group">{t('groups.index.type.group')}</SelectItem>
                <SelectItem value="class">{t('groups.index.type.class')}</SelectItem>
              </SelectContent>
            </Select>
          </AccountField>

          <div className="grid grid-cols-2 gap-3">
            <AccountField
              label={t('groups.form.totalSeatsLabel')}
              htmlFor="group-total-seats"
              error={errors.totalSeats}
              hint={t('groups.form.totalSeatsHint')}
            >
              <Input
                id="group-total-seats"
                type="number"
                min={0}
                value={draft.totalSeats}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, totalSeats: event.target.value }))
                }
              />
            </AccountField>

            <AccountField
              label={t('groups.form.expirationDateLabel')}
              htmlFor="group-expiration-date"
              error={errors.expirationDate}
            >
              <Input
                id="group-expiration-date"
                type="date"
                value={draft.expirationDate}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, expirationDate: event.target.value }))
                }
              />
            </AccountField>
          </div>

          <label className="flex items-center gap-2 text-body text-ink">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--accent)]"
              checked={draft.isFreeTrial}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, isFreeTrial: event.target.checked }))
              }
            />
            {t('groups.form.isFreeTrialLabel')}
          </label>
        </div>

        {mutation.isError ? (
          <FormNotice tone="crit">
            {isApiError(mutation.error) ? mutation.error.message : t('groups.form.error')}
          </FormNotice>
        ) : null}

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => handleOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button size="sm" disabled={mutation.isPending} onClick={() => void submit()}>
            {mutation.isPending ? t('groups.form.saving') : t('groups.form.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
