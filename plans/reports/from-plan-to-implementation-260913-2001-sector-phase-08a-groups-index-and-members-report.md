# Sector Phase 8, part one — Groups index and the members surface

**13 Sep 2026.** Branch `feat/sector-phase-08`, 9 commits, merged into `feat/sector` at
`681811c`. Part two (exports, member and group forms) follows on `feat/sector-phase-08b`.

## What shipped

- `/administer/groups` — the groups index: name, type, members, leaders, seats used /
  total, expiry; server-side search and pagination.
- `/administer/groups/:groupId/members` — ONE members surface; the column set is a
  function of the caller's role (`members/columns.ts`, tested), no role switcher.
- api-client `schemas/group.ts` (extends the existing `userGroupSchema`), `schemas/
  group-member.ts`, endpoints, hooks, `groupKeys`; fidelity entries for `groups` (1,476 /
  100%) and `groupmembers` (6,772 / 100%, 21,610 dropped where the mirror lacks the user
  document, as the route's `$unwind` would).
- The `group-administration` placeholder retired; the nav entry keeps its id, path and
  label and is gated on `read:group`.
- `groups` i18n namespace, 39 keys × 7 locales, parity test.

## The scoping decision

`GET /api/groups` and `GET /api/group-members` apply no caller scoping: a group leader
holding `read:group` would receive every group in the system. The hooks therefore branch
on the caller's permissions — `full-access` / `admin:full-access` use the unscoped routes,
everyone else the server-scoped `GET /api/groups/manage` and `/api/groups/manage/member/
:groupId`, which resolve the caller's led groups and their descendants. The administrator
role carries `full-access` but not `admin:full-access`, which the scoped routes' bypass
checks; sending administrators to the scoped routes would have shown them almost nothing.
The dashboard's own parent-groups route was rejected because it lists only groups with
children (148 of 579 root groups have none).

## What the review caught

- The leader-scoped members route parses a keyword and drops it (`manager.controller.ts`
  had a comment where the assignment should be), so a leader's search was a silent
  no-op. Fixed server-side on API branch `feat/sector-group-member-search` (one line);
  the client JSDoc states the gap until that lands.
- Comments over-claimed that `read:group` guards every route; reworded to what each route
  really checks.
- A permanently disabled row-actions button shipped; removed until real actions exist.
- The live opt-in suite gained the leader-scoped group calls.

## Verified in a browser, against the mirror stack

- Administrator: index renders 20 of the 1,476 live groups on page one.
- Reviewer (leads the largest production queue): exactly its one group, 201 members, 195
  of 200 seats; members page paginates 1–20 → 21–40 of 201. No console errors.

## Server-side findings for tickets

1. `GET /api/groups` counts soft-deleted groups in `totalItems` (1,519 vs 1,476 live);
   the last pages come back empty. The client shows its past-the-end state.
2. The unscoped `GET /api/groups` / `GET /api/group-members` remain reachable by a leader
   with `curl`; the client routes around it, the server should scope it.
3. The client's permission check is exact-match while the server treats `full-access`
   as a wildcard (pre-existing; the scan-surface phase handles wildcards).

## Unresolved questions

1. Should a single-group endpoint exist so the members page shows the group's name on a
   cold deep link? Today it falls back to "Members".
