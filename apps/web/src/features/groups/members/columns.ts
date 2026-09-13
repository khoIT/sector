/**
 * Role -> column set for the ONE members surface.
 *
 * The dashboard this replaces carried two separate members screens because
 * "a leader needs something different" kept getting solved as a new screen.
 * It is a column set: everything a group leader sees, an administrator also
 * sees, plus one more column (a row-actions seam later slices wire up). This
 * file is the proof — `columns.test.ts` asserts the two configurations below
 * are the same array with one entry appended, never two hand-maintained lists
 * that can drift apart.
 *
 * "Viewing as" is the caller's REAL capability, not a switcher: resolve
 * `MembersViewerRole` once, from `hasAnyPermission(user, GROUP_ADMIN_BYPASS_PERMISSIONS)`,
 * at the call site in `members-surface.tsx`.
 */
export type MembersViewerRole = 'leader' | 'administrator';

export type MemberColumnId = 'member' | 'role' | 'status' | 'joined' | 'expires' | 'actions';

export type MemberColumnDef = {
  id: MemberColumnId;
  /** i18n key for the column header. */
  labelKey: string;
  numeric?: boolean;
};

/** Every role that can open this surface sees these, in this order. */
const SHARED_COLUMNS: readonly MemberColumnDef[] = [
  { id: 'member', labelKey: 'groups.members.columns.member' },
  { id: 'role', labelKey: 'groups.members.columns.role' },
  { id: 'status', labelKey: 'groups.members.columns.status' },
  { id: 'joined', labelKey: 'groups.members.columns.joined' },
  { id: 'expires', labelKey: 'groups.members.columns.expires' },
];

/**
 * The seam for role/invite actions a later slice implements. Left as a bare
 * column (no menu contents yet) rather than a disabled button with a tooltip
 * — there is nothing to explain yet, so nothing is rendered until there is.
 */
const ADMINISTRATOR_ONLY_COLUMNS: readonly MemberColumnDef[] = [
  { id: 'actions', labelKey: 'groups.members.columns.actions' },
];

export function memberColumnsFor(role: MembersViewerRole): readonly MemberColumnDef[] {
  return role === 'administrator'
    ? [...SHARED_COLUMNS, ...ADMINISTRATOR_ONLY_COLUMNS]
    : SHARED_COLUMNS;
}
