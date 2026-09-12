---
title: The study surface becomes set up / work / commit
status: completed
created: 2026-09-13
---

# The study surface becomes set up / work / commit

The one-surface flow says five facts twelve times across eight blocks. The job
it serves has one dependency — scan type opens the ontology — and two things
that hang off nothing: sharing and uploading.

Rebuild it as three blocks. The ordered wizard is untouched.

## Decided before starting

- **No organization control.** `scans_org-with-forms_all` is off everywhere
  (confirmed with the user), so `organizationId` stays `null` and the generic
  `/api/scan-type/:id/items` stays correct. Not a gap.
- **Groups gate nothing.** `UserGroup` is `{id, name, slug, parent}` with no
  organization on it. Groups sit in the setup row only because routing is fixed
  at submit and the page's basement is the wrong home for that.
- **Expert review keeps its own block.** It spends money and nests a purchase
  dialog; putting it inside the submit confirm would nest dialogs.

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | [A combobox the product does not have](phase-01-a-combobox-the-product-does-not-have.md) | completed |
| 2 | [Set up, work, commit](phase-02-set-up-work-commit.md) | completed |

## Acceptance criteria

- [x] Scan type and groups are searchable comboboxes in one setup row
- [x] The 22-tile grid no longer appears in the study flow (it stays in classic)
- [x] Upload is a control plus the viewer-as-dropzone, never a full-width slab
- [x] Media is sticky beside the findings for the whole surface, not one card
- [x] Submit happens from the surface through a confirm that names the groups
- [x] A failed or detached file still blocks and still says so
- [x] The classic wizard renders and submits exactly as before
- [x] `pnpm -w typecheck`, `lint`, `build` clean; 445 tests pass (272 web / 91 api-client / 82 ui)

## Out of scope

Organization gating and the `forms` array. Both wait on the flag.
