---
phase: 1
title: Stop losing the learner's work
status: completed
effort: S
---

# Phase 1: Stop losing the learner's work

## Overview

Choosing a different scan type silently discards every finding already answered. Twelve
answers on a FAST study become zero the moment someone clicks Lung, with no dialog, no undo
and no count. This phase makes the switch carry over what genuinely transfers and name what
cannot, before Phase 2 puts the picker one click from every screen.

## The defect, exactly

`steps/step-interpretation.tsx` — the picker's `onChange`:

```tsx
update({
  scanTypeId: scanType.id,
  scanTypeName: scanType.name,
  findings: scanType.id === state.scanTypeId ? state.findings : {},
});
```

The `scanType.id === state.scanTypeId` guard is right and is the one thing the legacy version
got wrong (re-selecting the current type there set it to empty and unmounted the findings
block entirely — `form-interpret.tsx:648-651`). The `: {}` is the defect. It is a deliberate
decision — the comment says findings are keyed per scan type, which is true — but the learner
is never told, and nothing survives that could have.

## Requirements

- Functional: a scan-type change presents what carries over and what is cleared, by name, and
  does not apply until confirmed. Confirmed answers land on the destination type's keys.
- Functional: changing to the same type is a no-op with no dialog.
- Functional: a change with nothing answered yet applies immediately with no dialog — the
  dialog must not become a speed bump on the common path.
- Non-functional: the compatibility rule is pure and unit-tested; no network call to decide.

## Architecture

**Compatibility rule.** An answer transfers only when the destination type has a definition
that matches on all three of:

1. **Normalised name** — trimmed, lower-cased, punctuation and multiple spaces collapsed.
2. **Control kind** — the `FindingDefinition` shape already drives `finding-controls.ts`;
   a select cannot receive a free-text answer.
3. **Identical option set** for choice controls, compared as a sorted set of values.

Name alone is not enough and this is the reason: *Effusion* on a Cardiac type and *Effusion*
on a FAST type can carry different option sets and different clinical meaning. Moving an
answer between them silently would be worse than clearing it, because the learner would never
look at it again.

**Why the dialog lists items rather than counting them.** "4 answers will be cleared" does not
let anyone judge whether to proceed. "LV systolic function — Normal, Pericardial effusion —
None" does.

**Where the definitions come from.** `useFindingDefinitions(scanTypeId, organizationId)` is
already the source for the current type. The destination type's definitions must be fetched
before the dialog can list anything, so the flow is: click → fetch destination definitions →
compute the split → show the dialog. While the fetch is in flight the picker shows a pending
state on that tile; a failed fetch falls back to the current clear-everything behaviour with
an explicit warning rather than blocking the switch.

## Related Code Files

- Modify: `apps/web/src/features/create-scan/steps/step-interpretation.tsx` — the `onChange`
- Modify: `apps/web/src/features/create-scan/components/scan-type-picker.tsx` — per-tile pending state
- Create: `apps/web/src/features/create-scan/model/transfer-findings.ts` — the pure rule
- Create: `apps/web/src/features/create-scan/model/transfer-findings.test.ts`
- Create: `apps/web/src/features/create-scan/components/switch-scan-type-dialog.tsx`
- Read: `apps/web/src/features/create-scan/model/finding-controls.ts` — definition + answer shapes
- Read: `packages/api-client/src/react/use-create-scan-lookups.ts` — the definitions hook

## Implementation Steps

1. `transfer-findings.ts`: `planFindingTransfer(fromDefinitions, toDefinitions, answers)`
   returning `{ carried: FindingAnswers, kept: LabelledAnswer[], cleared: LabelledAnswer[] }`.
   Pure, no React, no I/O.
2. Unit tests first, from real data shapes: matching name + options transfers; matching name +
   different options clears; matching name + different control kind clears; an unanswered row
   appears in neither list; an answer whose definition no longer exists clears.
3. `switch-scan-type-dialog.tsx` over the existing `Dialog` primitive — destination name in the
   title, the kept list and the cleared list as two labelled groups, `Keep <current>` and
   `Switch to <destination>`.
4. Wire the picker: fetch destination definitions on click, compute, and skip the dialog
   entirely when `cleared.length === 0`.
5. Organization change: check whether changing organization re-keys findings the same way. If
   it does, route it through the same dialog rather than writing a second one.

## Tests / Validation

- `transfer-findings.test.ts` covers the five cases above.
- Browser: answer 5+ findings on a FAST type, switch to AAA, confirm the dialog names them,
  cancel, confirm the answers are intact, switch again, accept, confirm only compatible
  answers survived.
- Browser: switch type with nothing answered — no dialog appears.

## Success Criteria

- [x] No code path clears a findings answer without the learner having seen its name
- [x] Re-selecting the current scan type remains a no-op
- [x] Switching with zero answers shows no dialog
- [x] `planFindingTransfer` is pure and covered by unit tests — 12 cases
- [x] A failed definitions fetch degrades to today's behaviour, through the same dialog so the loss is still named

## Risk Assessment

### Measured before trusting the rule

Run over **every ordered pair of v2 scan types** — the richest generation, 251 definitions —
against local `gusi_dev`:

| | rows | carried |
|---|---|---|
| strict rule (name + kind + options) | 4,655 | **28 (1%)** |
| name-only rule | 4,655 | 36 (1%) |

Two things follow.

**The strict rule costs almost nothing.** Loosening to name-only buys 8 rows out of 4,655.

**Those 8 rows are exactly the ones that must not move.** The clearest is AAA → Gallbladder,
where both types have a row called *Long*: AAA's offers aorta diameters
`≤ 3cm / >3 cm / Indeterminate / Not Examined`, Gallbladder's offers `Long / Not Examined`.
A name-only rule files an aortic measurement as a gallbladder finding, in a control that
cannot display it. FAST ↔ FASH is subtler — *RUQ - Free Fluid Abdomen* on both, differing only
by whether `Not Examined` is offered — and one direction would store a value the destination
does not have.

**And the headline number is the real finding: scan types share almost nothing.** Transfer is
~1% either way, so on nearly every switch the kept list is empty and the dialog's whole job is
naming the loss. The dialog is ordered accordingly — cleared first, carried second.

| Risk | Mitigation |
|---|---|
| ~~The three-way match is too strict and transfers almost nothing~~ | **Measured, and accepted.** 28 vs 36 rows out of 4,655; the 8 it refuses are the wrong ones to move. See above |
| Definitions fetch makes the picker feel slow | Pending state on the clicked tile only; the rest of the grid stays live. The fetch is already cached by TanStack Query for any type visited before |
| Dialog becomes a habitual click-through | It only appears when something is actually lost, which on the common path is never |
