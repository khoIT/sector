---
phase: 8
title: "Group administration"
status: pending
priority: P1
effort: "15 days"
dependencies: [1]
---

# Phase 8: Group administration

## Overview

Groups index, **one** role-parameterised members surface, four exports, and the form
layer. The dashboard spends ~7,800 lines here of which about 2,300 are dead routes, and
carries two separate members screens plus a 1,189-line member table with Excel export.

Build one surface whose columns and actions are a function of role. Flipping "viewing
as" changes the columns, not the screen — demonstrated in the prototype.

## Related code files

- Create: `apps/web/src/features/groups/index/**`
- Create: `apps/web/src/features/groups/members/members-surface.tsx`
- Create: `apps/web/src/features/groups/members/columns.ts` — role → column set
- Create: `apps/web/src/features/groups/exports/**` — members, course progress, scan
  activity, CME hours
- Create: `apps/web/src/features/groups/forms/**` — create/edit group, invite, roles
- Create: `packages/api-client/src/endpoints/group.ts`, `group-member.ts`,
  `group-export.ts`, `group-assignment.ts`
- Reuse: the group schema Sector already ships on the scan side — one schema for the
  write side and the read side, not two

## Implementation steps

1. Groups index: name, members, leaders, notification state, scoped to what the role
   may see.
2. Members surface with a role-parameterised column set. Prove it by rendering the
   group-leader and administrator variants from one component in a test.
3. Exports. CSV, generated server-side where the dashboard did it client-side — a
   1,189-line table that builds an Excel file in the browser does not need porting.
4. Forms: create and edit a group, invite members, assign roles, group courses and
   group assignments.
5. Wire the per-group scan-notification settings built in Phase 3 into the group view.

## Tests / validation

- Unit: column sets per role; export row shaping.
- Fidelity: render the largest real group in the mirror (126+ members) and page it.
- Browser: leader and administrator accounts see their own correct surfaces.

## Success criteria

- [ ] One members component, two role configurations, no second screen
- [ ] Four exports produce correct CSV at real group sizes
- [ ] Group schema is shared with the scan surfaces, not duplicated
- [ ] No dead routes carried over

## Risk / rollback

Self-contained; nothing else depends on it except the home screen's group panels.
The main trap is re-creating the second members screen under a different name because
one role "needs something different" — that is a column set, not a screen.
