# Course Read Seam — Blocker Remediation

Branch `fix/sector-course-shapes`, worktree `<scratchpad>/wt/fix-course-shapes`, merged up to `feat/sector` at `2d46bf3`.
4 commits + 1 merge. 22 files, +1,401 / −147.

## The four blockers, fixed and proved

All four were whole-surface failures: `client.ts` throws `ApiError{kind:'parse'}` on a schema miss, so the page rendered "could not be loaded".

Proof is the same payloads in both directions — the live mirror response run through the merged schemas and through the fixed ones:

```
[merged feat/sector] My Courses page: FAILS — items.0.expiresAt: Required | items.1.progress.completedTopics: Required
[merged feat/sector] outlines parsed: 114/116
     681a4b50779a0d9e6c9cc4f2 → items.14.status: received 'failed'
     69bdd60f2b7ea17fe980ddc6 → courseMetaVersion: Expected number, received null
[fix/sector-course-shapes] My Courses page: PARSES
[fix/sector-course-shapes] outlines parsed: 116/116
```

1. **`items[].status: 'failed'`** — added as a separate `courseItemProgressStatusSchema` (4 values). The course-level `courseProgressStatusSchema` stays at three, because every writer of a course-level status derives one of those; only items take `failed`.
2. **`expirationType: 'course_assignment'`** — added to `EXPIRATION_TYPES`.
3. **Absent keys from `.lean()` reads** — `expiresAt`, `enrolledAt`, `userCourseStatus`, the eight progress counters and the four version totals now carry **the same default the Mongoose model declares**, because a lean read does not apply them and `JSON.stringify` drops the key. A value of the wrong *type* still fails; two tests assert that.
4. **`courseMetaVersion: null`** on the outline — nullable, matching the two branches the controller documents.

## Should-fixes, all four done

- **Empty course no longer claims completion.** Completion is `totalItems > 0 && completedItems >= totalItems` (`isOutlineComplete`), not "nothing to resume". Browser, course `68f04e61…`: `0/0 completed (0%) | This course has no content yet` and **no** banner.
- **Resume never selects a blocked quiz.** `resolveResumeTarget` honours the server pointer when it is openable and otherwise takes the first openable item in the server's order. Nothing re-derives navigation; `order` still decides. Six unit tests, including "all that is left is blocked" → no action rather than a dead one.
- **`expired` no longer repeats.** The route sends the whole array with every page, so the section renders under page 1 only. Browser: page 1 has it, page 2 has none.
- **The Expired filter is gone from the menu.** It could only ever produce an empty grid, since the route moves those rows into the separate array. The keyword-shaped empty-state sentence now has a filter-shaped variant, so status-only narrowing no longer renders `No course title matches “”.`

Also: URL filter values outside the menu are dropped rather than forwarded to a 400 whose validator text became the learner's error message.

## The gap that let them through

Your framing was right and the numbers were worse than the report implied. The manifest replayed **one** course schema (the embedded course document) and excused eleven, so "fidelity 100%" covered none of the four broken shapes. Three excuses are now real entries:

| entry | documents | parsed |
|---|---|---|
| `usercourses → a personal My Courses row` | 115 | 100.00% |
| `groupcourses → a group-assigned My Courses row` | 2,018 | 100.00% (953 the route would drop) |
| `usercourseprogresses → the item statuses the outline serves` | 9 | 100.00% |
| `v2courses → the course inside a My Courses item` (existing) | 117 | 100.00% |

The outline has no collection to walk, and emulating its traversal in the manifest would test this package against a second implementation of the thing under test. It is covered by the **route replay** instead, which now walks every page of My Courses and the outlines that can differ:

```
learner@sector.test my courses pages    2   2  100.00%
learner@sector.test course outlines    32  32  100.00%  (1 the route would drop)
leader / reviewer / admin              1+2, 1+2, 1+0    100.00%
```

Outline selection is a rule, not a sample size: every group or expired row, every row with a progress document behind it, and one in five of the rest. Every shape that can carry a blocker lives in a progress document, and outlines are the heaviest read the API serves. A 404 for an expired enrolment is the access rule answering and is counted as dropped; a 404 for a live row still fails the gate.

Each remaining excuse now says what would have to exist to replay it (for the outline: a stored, resolved outline document, which this API has never had).

**`pnpm fidelity` was not running the route replay at all.** `turbo.json` declared no `passThroughEnv`, so the secret never reached the task and the half that needs it skipped while the run reported a pass — the exact trap you warned about, in the gate itself. Fixed; the run now reports 56 tests instead of 31.

## Seeding

`scripts/data/seed-test-accounts.ts` gives the learner a group of its own (`sector-course-fixtures`) with two assignments — **one with no `expiresAt` key at all**, one already lapsed — plus two progress rows written the way the API writes them: a quiz answered below its passing mark (`status: 'failed'`), and a pre-migration row with no version pin and no key for two counters. Fixtures only ever add; a progress row the learner already has is left alone. `--remove` takes the group and its assignments with it.

Live result: `items 116, expired 1`, `expirationTypes {None: 116, course_assignment: 1}`, `rows with no expiresAt key: 1`, and one outline each carrying `failed` and `courseMetaVersion: null`.

## Gates (all after merging `feat/sector`)

| gate | result |
|---|---|
| lint + prettier | clean, 3/3 tasks |
| typecheck | clean, 3/3 tasks |
| test | **1,096 passed** — ui 123, api-client 197, web 776 |
| build | ✓ built in 2.74s |
| fidelity (secret read off the running `:5002` per README) | **56 passed**, route replay ran |
| cold-load sweep | **27/27 routes healthy**, own Vite on `:3109 --strictPort` |

Browser, on my own server, four screens, no console errors:

- failed quiz → `Retry: PreCourse Quiz`, one `Not passed` pill, no banner
- empty course → `This course has no content yet`, no banner
- My Courses → the group row with no `expiresAt` renders in the grid, expired section present once
- page 2 → expired section absent

Server hygiene: I started one Vite (`:3109`) and killed it by PID. `:5002` (17176) and `:3101` (17213) were left alone.

## Two things you should know

1. **I brought the old `:5002` down once.** My first route-replay pass fetched every outline for all four accounts on top of the existing scan walks, and the API died mid-run (`SocketError: other side closed`, PID gone). I restarted it from the README command with the same secret and verified login before continuing — and then bounded the outline pass to the rule above, which is why it now costs 32 requests rather than 121. You have since restarted the stack yourself; the current instance is yours, not mine.
2. **An expired enrolment 404s on the outline route** while still appearing in the list's `expired` array. That is the access rule working, and the UI already renders expired rows as text rather than links, so nothing is broken — but Phase 7's runner will meet the same 404 and should treat it as "no longer yours", not as an error.

## Tests added

- `packages/api-client/src/schemas/course.test.ts` — 9 tests, each payload a verbatim mirror response body, with `course.author` replaced by the empty-author record the API itself sends when an author reference does not resolve (real names and addresses do not belong in the repo). Four assert the blocker shapes parse; three assert that drift — an invented enum value, a counter of the wrong type, a course-level `failed` — still fails.
- `apps/web/.../course-outline-model.test.ts` — 10 new tests for `resolveResumeTarget` and `isOutlineComplete`.
- `course-row-model.test.ts` — the filter-menu test now asserts the six offered values and that `expired` is deliberately not among them, with the mirror response that proves why.

## Unresolved questions

1. The API-side fix for the resume pointer (filter `blockedReason` in `learners.outline.helper.ts`) is still unmade — I did not touch `wt/api`, because editing it restarts the shared `:5002` under ts-node-dev. The client is defensive now, so this is no longer urgent, but the server is still handing out unopenable resume targets to any other consumer.
2. Same for the API's `enrolledAt`/`userCourseStatus`/counter coalescing: the client tolerates the absent keys, but the route would be more honest sending the model defaults itself.
3. `schemas/assignment.ts` arrived in the merge with shared assignment enums. Nothing in the course seam overlaps it today, but if group course assignments grow a read model, `learnerCourseGroupSchema` and it should be reconciled once rather than twice.
4. Should `expired` stay unpaginated? Page-1-only is correct for today's volumes; a learner with hundreds of expired enrolments would still render them all at once.

Status: DONE
Summary: All four blockers are fixed and proved against live mirror payloads in both directions, the four should-fixes are done and confirmed in a browser, and the fidelity gap that let them through is closed — three collection entries plus a bounded route replay, with the turbo config bug that was silently skipping the route half fixed too.
Concerns/Blockers: I crashed the previous `:5002` instance with the first unbounded replay pass and restarted it from the README command with the same secret; the replay is now bounded. The API-side resume-pointer fix remains unmade because editing the API worktree restarts the shared mirror.
