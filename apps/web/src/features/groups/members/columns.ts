/**
 * Role -> column set for the ONE members surface.
 *
 * The dashboard this replaces carried two separate members screens because
 * "a leader needs something different" kept getting solved as a new screen.
 * Here it is a column set instead: `memberColumnsFor('leader')` and
 * `memberColumnsFor('administrator')` return the SAME array today —
 * `columns.test.ts` asserts that directly — because the write slice (role
 * changes, removal) that would make an administrator's set diverge is not
 * yet wired. When it lands, an administrator's extra column is appended
 * here, which is what keeps this one surface rather than a second screen.
 *
 * "Viewing as" is the caller's REAL capability, not a switcher: resolve
 * `MembersViewerRole` once, from `hasAnyPermission(user, GROUP_ADMIN_BYPASS_PERMISSIONS)`,
 * at the call site in `members-surface.tsx`.
 */
export type MembersViewerRole = 'leader' | 'administrator';

export type MemberColumnId = 'member' | 'role' | 'status' | 'joined' | 'expires';

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
 * `role` is not yet read: both configurations are `SHARED_COLUMNS` until the
 * write slice gives an administrator something a leader does not get. The
 * parameter stays so every call site is already role-aware and needs no
 * change when that happens.
 */
export function memberColumnsFor(_role: MembersViewerRole): readonly MemberColumnDef[] {
  return SHARED_COLUMNS;
}
