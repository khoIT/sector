---
phase: 1
title: "A combobox the product does not have"
status: completed
priority: P1
dependencies: []
---

# Phase 1: A combobox the product does not have

## Why not one of the three that exist

- **`Select`** — Radix, native-feeling, no search. Fine for five options, useless
  for twenty-two scan types.
- **`DropdownMenu`** — Radix menus claim printable keys for typeahead, so a text
  input inside one never receives what is typed. This is not styling; it is what
  the menu role is for.
- **`Dialog`** — a modal to pick an exam type is a modal too many.

So `packages/ui/src/components/combobox.tsx`: trigger, search, filtered list,
single or multiple.

## Constraints it had to respect

**No icon dependency.** The package deliberately has none — `empty-state` takes
a lucide element as a prop, `select` draws its own chevron inline. The combobox
draws the same two glyphs `select` does rather than adding `lucide-react` to a
package that has spent its life without it.

**No positioning dependency.** The popover is plain absolute positioning, not a
portal. Every use sits in normal flow near the top of its container.

**Testable logic in a `.ts`.** The package's vitest runs `environment: 'node'`
over `src/**/*.test.ts`, so matching lives in `combobox-filter.ts` and is tested
there — 13 cases.

## Two decisions in the filter

**Every term, any order.** The literal string `"msk knee"` never occurs in
`"MSK - Knee"`, so a whole-string search finds nothing. Terms are matched
independently against the label and the description together.

**Input order is preserved, not ranked.** A list that reorders while you type
makes the eye re-scan from the top on every keystroke.

## The bug the browser found

Escape was handled on the search input's `onKeyDown`. In a multi-select the
focus moves to the option button the moment one is ticked — so Escape worked
exactly until the control was used, and then silently stopped. Caught by a
Playwright walk, not by a test.

It is a document-level listener while open now, and it returns focus to the
trigger. The same listener the outside-click handler already needed.
