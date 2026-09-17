---
phase: 3
title: My Courses density and list view
status: completed
priority: P2
effort: 2d
dependencies:
  - 1
---

# Phase 3: My Courses density and list view

## Overview

Give My Courses a grid/list toggle in URL state, a compact card that stops
spending 230px on a placeholder image, and the facts already on the wire —
description excerpt, lesson/topic/quiz counts, expiry, last active.

## Requirements

**Functional**

- `view=grid|list` in the URL, alongside the existing `keyword`/`filters`.
  Default `grid`; an unknown value falls back to `grid`.
- Grid: 1 / 2 / 3 / **5 at `2xl`** columns.
- List: one row per enrolment — title, status, progress, counts, expiry, last
  active, one action.
- Compact card: when `course.imageUrl` is null (92 of 102 production courses),
  render a slim header strip, not a 16:9 box.
- Description excerpt: HTML stripped, ~140 chars, ellipsis.
- Counts from `courseMetaVersion.totalLessons / totalTopics / totalQuiz`.
- Expiry from the list item's `expiresAt`; last active from
  `progress.lastAccessedAt`.

**Non-functional**

- No API change. Every field above is already parsed:
  `packages/api-client/src/schemas/course.ts` — `learnerCourseSummarySchema`
  carries `content` and `imageUrl`, `learnerCourseProgressSchema:174` carries
  `lastAccessedAt`, `learnerCourseMetaVersionSummarySchema:203-209` carries the
  three totals, and `learnerCourseListItemSchema` carries `enrolledAt` /
  `expiresAt` / `isExpired`. No schema edit → `fidelity/manifest.ts` untouched.
- Every string through `t()`; new keys in all seven locales; zero baseline
  additions.
- 50 enrolments fit in ≤ 2 screens at 1440 in list view.

## Architecture

```
useListUrlState()  ──► url.filters  ──► filterValue(filters,'status')   (exists)
                                    └─► filterValue(filters,'view')     (new)
                        setFilter(filters,'view', 'list'|undefined)

useCourses(...) ──► items: LearnerCourseListItem[]
                         │
            courseCardModel(item, t)  (pure, new)
                         │
        ┌────────────────┴────────────────┐
   <CourseCard>  (grid)            <CourseListRow>  (list)
```

The toggle rides on the EXISTING filter param rather than a new query
parameter: `list-url-state.ts` already parses, serialises and clears
`filters`, and `hasActiveNarrowing` would otherwise start treating a layout
choice as a narrowing and offer "clear search". Guard that explicitly —
`hasActiveNarrowing` must ignore the `view` filter.

Both renderers read one pure model so the two cannot state different counts:

```ts
type CourseCardModel = {
  title: string; href: string; percent: number;
  statusKey: string; tone: BadgeTone;
  excerpt: string | null;          // stripped, clamped
  counts: { lessons: number; topics: number; quizzes: number };
  expiresAt: string | null; lastActiveAt: string | null;
  hasCover: boolean;
};
```

## Related Code Files

Create:

- `apps/web/src/features/courses/my-courses/course-card-model.ts` +
  `course-card-model.test.ts` — the model above, plus `excerptFromHtml()`
- `apps/web/src/features/courses/my-courses/course-list-row.tsx`
- `apps/web/src/features/courses/my-courses/course-layout-toggle.tsx`

Modify:

- `apps/web/src/features/courses/my-courses/my-courses-page.tsx` — toggle in the
  filter bar (line 96-134), branch the results block (line 176-182), skeleton
  variant per layout (line 136-141), `2xl:grid-cols-5` on both grids
- `apps/web/src/features/courses/my-courses/course-card.tsx` — compact card;
  slim strip when `!item.course.imageUrl`; excerpt, counts, expiry, last active
- `apps/web/src/features/scan-list/table/list-url-state.ts:76-78` —
  `hasActiveNarrowing` ignores `view`
- `apps/web/src/features/courses/my-courses/expired-courses-section.tsx` — the
  expired section renders through the same row/card pair
- `apps/web/src/i18n/locales/{en,de,es,fil,fr,it,pt}.json` — `courses.index.*`

Delete: none.

## Tests Before

Node environment, `*.test.ts` only. No rendering.

1. `apps/web/src/features/scan-list/table/list-url-state.test.ts` — if it does
   not exist, create it and pin today's behaviour first:
   `parseFilters`, `filterValue`, `setFilter` (replace / drop / keep others),
   and `hasActiveNarrowing` true for a keyword, true for a status filter, false
   for neither. This is the file phase 3 modifies, so it needs a pin.
2. Extend `apps/web/src/features/courses/my-courses/course-row-model.test.ts`
   with the current `courseActionLabelKey`, `courseProgressTone` and
   `roundedProgress` outputs for all four statuses — the card rewrite must not
   change a single label.
3. Sweep `/learn/courses` at 390 / 1440 / 2200 and record the page height with
   50 enrolments (the "before" number the acceptance criterion is measured
   against).

## Refactor

1. `hasActiveNarrowing` ignores `view` — smallest change first, with its test.
2. `course-card-model.ts` extracted from what `course-card.tsx` computes today
   (`roundedProgress`, the status key, the link), then extended.
3. `course-card.tsx` re-expressed on the model; compact layout.
4. `course-list-row.tsx` on the same model.
5. Toggle + page branch.

## Tests After

- `course-card-model.test.ts`:
  - `excerptFromHtml('<p>Hello <b>world</b></p>')` → `'Hello world'`
  - `excerptFromHtml('<p></p>')` and `excerptFromHtml('&nbsp;')` → `null`
    (reuse the absent-vs-empty rule from
    `landing/course-landing-model.ts:41-49`; do not write a second one)
  - a 400-char description clamps to ≤ 143 chars including the ellipsis, and
    clamps on a word boundary
  - `hasCover` false when `imageUrl` is null
  - counts come from `courseMetaVersion`, never recounted
- `list-url-state.test.ts`: `hasActiveNarrowing` false when the only filter is
  `{id:'view',value:'list'}`, true when `view` sits beside a status filter.

## Implementation Steps

1. `list-url-state.ts`: add `const LAYOUT_FILTER_ID = 'view';` and change
   `hasActiveNarrowing` to
   `state.filters.filter(f => f.id !== LAYOUT_FILTER_ID).length > 0 || keyword…`.
   Export the constant so the page and the toggle share it.
2. `course-layout-toggle.tsx`: two `Button`s (`variant="ghost"`, `size="sm"`)
   in a `Toolbar`, `aria-pressed` on the active one, icons `LayoutGrid` /
   `List` from `lucide-react` (already a dependency), labels through
   `t('courses.index.layout.grid' | 'courses.index.layout.list')`.
3. `course-card-model.ts`:

   ```ts
   export function excerptFromHtml(html: string | null | undefined, max = 140) {
     if (!html) return null;
     const text = html.replace(/<[^>]*>/g, ' ')
       .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
       .replace(/\s+/g, ' ').trim();
     if (!text) return null;
     if (text.length <= max) return text;
     return `${text.slice(0, text.lastIndexOf(' ', max))}…`;
   }
   ```

   Note this strips tags for a text excerpt; it is NOT a sanitiser and must
   never be used to render HTML — the landing page keeps `RichText`.
4. `course-card.tsx` compact form:
   - with cover: `aspect-[16/9]` image, unchanged
   - without: `<div className="h-1.5 w-full bg-accent-soft" />` header strip
     plus the `GraduationCap` glyph inline beside the title — target: nothing
     decorative taller than 96px
   - body: title, `StatusPill`, excerpt (`line-clamp-2`), counts row with
     `sv-num`, progress bar, meta line (expiry / last active), action button
5. `course-list-row.tsx`: a single `rounded-token border border-line
   bg-surface` row, `flex` at `sm`+ and stacked below, columns
   title+excerpt | counts | progress | meta | action. Target ≈ 72px tall so 50
   rows ≈ 3,600px ≈ 2 screens at 1440 (900px viewport, 4 screens would be the
   failure).
6. `my-courses-page.tsx`: read the layout with
   `filterValue(url.filters, LAYOUT_FILTER_ID) === 'list' ? 'list' : 'grid'`;
   set it with `setFilter(url.filters, LAYOUT_FILTER_ID, next === 'grid' ? undefined : next)`
   so `grid` never appears in the URL.
7. Grid classes: `grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5`
   on BOTH the skeleton (line 137) and the results grid (line 177).
8. Skeletons: `aspect-[4/5]` today; use `h-[13rem]` for the compact card and
   `h-[4.5rem]` for a list row so the loading state matches what arrives.
9. Dates: use the existing helpers in `apps/web/src/lib/format.ts` (the same
   ones `list-cells.tsx` uses) — do not add a formatter.
10. i18n: `courses.index.layout.grid`, `.list`, `courses.index.counts`,
    `courses.index.expiresOn`, `courses.index.lastActive`, in all seven
    locale files. Zero additions to `locale-completeness-baseline.json`.

## Regression Gate

```bash
pnpm --filter @sector/web test
pnpm -w typecheck
pnpm -w lint
pnpm -w build
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

Manual: `/learn/courses` in both layouts; reload with `?filters=[…"view"…]` to
prove the URL round-trips; clear search with `view=list` set and confirm the
layout survives.

## Success Criteria

- [ ] Toggle persists across reload and is shareable in the URL; `grid` is the
      default and is absent from the URL.
- [ ] Clearing search/filters does not reset the layout.
- [ ] 50 enrolments occupy ≤ 2 screens at 1440 in list view (measure
      `document.body.scrollHeight`; ≤ 1,800px of content region).
- [ ] No decorative placeholder taller than 96px on a card without a cover.
- [ ] 5 columns at 2200.
- [ ] Counts, expiry and last active render without any new API call
      (Network tab shows the same requests as before).
- [ ] Zero additions to `locale-completeness-baseline.json`.
- [ ] No horizontal document scroll at 390px on `/learn/courses`.
- [ ] 3-width browser sweep (390 / 1440 / 2200) green.

## Risk Assessment

| Risk | L×I | Mitigation |
| --- | --- | --- |
| `view` filter leaks into the API query | M×H | `my-courses-page.tsx` builds the query from `keyword`/`status`/`page`/`limit` only (line 60-62); it never spreads `url.filters`. Assert in review; the server 400s on an unknown filter, so a leak is loud |
| `hasActiveNarrowing` change alters a Scan Vault empty state | M×M | The `view` id is not used by any scan list; `list-url-state.test.ts` pins both behaviours |
| `courseMetaVersion` totals absent on old rows | M×L | Schema already `.default(0)` for all three (course.ts:206-209); render `—` when all three are 0 |
| Excerpt renders raw HTML | L×H | `excerptFromHtml` returns text and is rendered as a text node; never passed to `RichText` or `dangerouslySetInnerHTML`. Pinned by test |
| List row too tall to hit the 2-screen target | M×M | Measure during implementation, not at review; the row is a single flex line from `sm` up |

**Rollback:** revert in reverse commit order; the `hasActiveNarrowing` change
is the only edit outside the courses feature and is independently revertible.
