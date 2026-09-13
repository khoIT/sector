import type { GroupMemberRoleValue, GroupMemberStatusValue } from '@sector/api-client';
import type { BadgeTone } from '@sector/ui';

/**
 * `StatusPill`/`Badge` tone is deliberately domain-free (see CONTRACTS.md
 * §3), so each domain maps its own values — same pattern as `scanStatusTone`
 * in `@sector/api-client`, just kept in the web layer since `BadgeTone` is a
 * UI-package type this API-client-free package should not import.
 */
export function memberStatusTone(status: GroupMemberStatusValue): BadgeTone {
  switch (status) {
    case 'active':
      return 'ok';
    case 'pending':
      return 'warn';
    case 'expired':
      return 'crit';
    case 'inactive':
      return 'neutral';
  }
}

export function memberRoleTone(role: GroupMemberRoleValue): BadgeTone {
  return role === 'leader' ? 'accent' : 'neutral';
}
