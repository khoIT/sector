---
phase: 3
title: "Interpret with the images on screen"
status: pending
effort: "M"
---

# Phase 3: Interpret with the images on screen

## Overview

The learner is asked to record what the study shows while the study is on a different step and
invisible. Put the media and the findings on one screen, in the geometry the reviewer already
uses, so a learner and their reviewer read the same study the same way.

## The asymmetry

`scan-detail-page.tsx` gives the reviewer media on the left and the review form on the right.
`step-interpretation.tsx` gives the learner a scan-type grid, a findings list and a note box,
with the images one step back. The learner is the person who was holding the probe and is the
only one who can say whether the window was adequate — and they are the one asked to answer
blind.

## Requirements

- Functional: on a wide viewport, media left and the findings/note form right; the media pane
  is sticky while the form scrolls.
- Functional: media is rendered from the local files, before any scan exists.
- Functional: at narrow widths the panes stack, media first.
- Non-functional: object URLs are created once per file and revoked on removal and unmount.

## Architecture

**Why a new viewer and not `ScanMediaViewer`.** The existing viewer takes `MediaFile[]` — id,
filename, filetype, and presigned CloudFront URLs. Pre-submit there is no scan, so there are
no presigned URLs; the bytes exist only as the `Blob` on each `DraftFile`. The viewer's
*chrome* is reusable and its *source* is not.

Split it: keep `ScanMediaStage` as-is — it already resolves kind through `mediaKindFor`, which
takes `{ filetype, filename }` and nothing else — and give the surrounding viewer a source
type that both a `MediaFile` and a `DraftFile` can satisfy:

```ts
type StageSource = { id: string; filename: string; filetype: string; url: string | null };
```

A `DraftFile` becomes one via `URL.createObjectURL(blob)`. Nothing in the stage changes.

**Object URL lifecycle.** One URL per draft file, created lazily, held in a ref map keyed by
file id, revoked when the file is removed and on unmount. Creating them per render leaks a
blob URL per frame, which on a 148 MB study is measured in hundreds of megabytes.

**Keyboard.** The existing viewer binds ArrowLeft/ArrowRight. The right-hand pane here is
entirely form controls, and the findings options are toggle groups that claim arrow keys for
roving focus. Check the collision first. If it is real, bind the viewer to `[` and `]` rather
than widening the "is the user typing" guard until it is unreadable — the guard already has to
special-case `INPUT`, `TEXTAREA` and `contentEditable`.

**Findings in a narrow rail.** The findings list has only ever rendered at full page width.
At ~450px the option grids need to stack label over control. Check `finding-row.tsx` renders
sanely at that width before committing to the split, and fix it there rather than in the
layout.

## Related Code Files

- Modify: `apps/web/src/features/scan-detail/components/scan-media-viewer.tsx` — accept `StageSource`
- Read: `apps/web/src/features/scan-detail/components/scan-media-stage.tsx` — unchanged
- Modify: `apps/web/src/features/create-scan/steps/step-interpretation.tsx` — two-pane layout
- Modify: `apps/web/src/features/create-scan/components/finding-row.tsx` — narrow-rail rendering
- Create: `apps/web/src/features/create-scan/model/draft-file-sources.ts` — blob URL lifecycle + test
- Read: `packages/api-client/src/media-kind.ts`, `schemas/common.ts`

## Implementation Steps

1. Widen `ScanMediaViewer` to `StageSource`; `MediaFile` already satisfies it structurally, so
   the detail page needs no change. Confirm by typecheck, not by editing it.
2. `draft-file-sources.ts`: a hook returning `StageSource[]` for the draft's files, creating
   and revoking object URLs. Files that are `detached` (no blob) yield `url: null`, which the
   stage already renders as "File not available".
3. Two-pane layout on the interpretation surface; stack under the existing breakpoint.
4. Check the arrow-key collision with a real toggle group before choosing the binding.
5. Verify `finding-row.tsx` at rail width; fix inside the component.

## Tests / Validation

- Unit: object URLs are revoked on removal and unmount; a detached file yields `url: null`.
- Browser: add a video and two stills, open interpretation, confirm all three play/render from
  local blobs with no network request to CloudFront.
- Browser: keyboard navigation moves between files without stealing focus from a findings
  toggle group.
- Browser: at 400px the panes stack with media first and nothing scrolls horizontally.

## Success Criteria

- [ ] Findings can be answered with the images visible, before submission
- [ ] No CloudFront request is made for a pre-submit file
- [ ] Object URLs are revoked; repeated add/remove does not grow memory
- [ ] The reviewer's detail page is unchanged
- [ ] Findings render correctly in a ~450px rail

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Blob URL leak on a 148 MB study | Ref-keyed map, revoke on removal and unmount, covered by a unit test |
| Arrow keys fight the findings toggle groups | Checked before the binding is chosen; `[` `]` is the fallback |
| Widening the viewer's prop type regresses the detail page | The new type is a structural subset of `MediaFile`; typecheck proves it |
| Findings unreadable in a narrow rail | Verified at rail width first; fixed in the row component where it belongs |
