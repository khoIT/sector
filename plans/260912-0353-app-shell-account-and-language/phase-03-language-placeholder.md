---
phase: 3
title: Language placeholder
status: completed
priority: P2
dependencies: []
---

# Phase 3: Language placeholder

## Overview

A language control in the header and the seam behind it — so the app has one place strings come
from before it has seven languages, rather than 3,000 literals to hunt down later.

## Requirements

- Functional: the header shows the active language with its flag; the menu lists the seven
  locales the legacy app ships; choosing one persists and survives a reload; English is
  complete and the rest are honestly marked as not yet translated.
- Non-functional: no translation file is invented. A locale with no strings falls back to
  English rather than rendering keys.

## Architecture

### Why a placeholder and not the real thing

Legacy ships seven locales — `en`, `es`, `it`, `de`, `pt`, `fil`, `fr` — as seven JSON files
loaded eagerly in `src/i18n/config.ts`. Translating Scan Vault's strings is a content job, not
an engineering one, and it cannot start until the strings stop moving. Two of the three plans
now open rewrite screens.

What can be done now, and is the expensive half to retrofit, is the **seam**: every user-facing
string reached through a key. Adding a language later is then a file. Adding the seam later is
every component.

So this phase ships the control and the seam with English populated, and the other six locales
listed and selectable but marked. A user who picks Français gets English text and a visible
note saying that language is not translated yet — which is the truth, and better than either
hiding the control or showing raw keys.

### Corrected at build time: it did not ship as a placeholder

**The legacy locale files are not empty, and they are not copies.** Each of the six non-English
files carries 2,775 keys against English's 2,824, and only 60 of them are byte-identical to the
English — they are real translations. The sections Scan Vault needs are fully covered in every
locale: `common` 108 keys, `scans` 549, `navigation` 25, `account` 113, `pagination` 9,
`datatable` 22, with zero missing.

So the six languages ship **working**, not marked. `scripts/import-legacy-translations.mjs`
matches Scan Vault's English strings against that corpus **by text rather than by key** — the
two apps' key trees have nothing in common — and lifts what it finds, carrying Scan Vault's own
interpolation names across. 51 of 124 strings match; the rest fall back to English.

That remainder is not a gap waiting on a translator so much as Scan Vault's own vocabulary:
Outcome, Waiting, Asked, `n not examined`, the rubric line, the media split. None of it has
ever been translated because none of it has ever existed. A "not translated yet" marker on six
of seven languages would have described a distinction that does not hold — every language
including English-adjacent ones falls back on exactly the same 73 strings — so the switcher
carries no marker.

**Product names are excluded.** The corpus has a match for "Scan Vault" and translates it word
by word; Spanish came back as *Escanea Bóveda*, which reads as "it scans vault" and names
nothing. `DO_NOT_TRANSLATE` in the import script holds those keys.

**Translated labels are longer than the English they were sized for.** *Escaneos de expertos*
against *Expert Scans* truncates in the 240px rail, caught in the browser rather than in
review, so nav entries gained a hover title.

### The control

Matches legacy: a flag icon plus the language name above `md`, the flag alone below it. Legacy
maps locale to flag country (`pt`→`br`, `fil`→`ph`, `en`→`us`) — reuse that map rather than
deriving it, because the derivation is wrong for exactly those three.

Legacy persists to `localStorage` under `language` and sets `document.documentElement.lang`.
Do both; the `lang` attribute is what a screen reader uses to pick a voice.

### Library choice

Legacy uses `i18next` + `react-i18next`. Match it: the translation files should be portable
between the two apps, the interpolation syntax should be the one GUSI's translators already
received, and `en.json` is a real starting corpus. Load locales lazily rather than eagerly —
seven eager JSON imports is a bundle cost legacy pays and this app need not.

## Related Code Files

- Create: `apps/web/src/i18n/config.ts` — locales, display names, flag map, default
- Create: `apps/web/src/i18n/locales/en.json` — seeded from the shell and scan-list strings
- Create: `apps/web/src/i18n/language-store.ts` — persistence and the `lang` attribute
- Create: `apps/web/src/shell/language-switcher.tsx`
- Create: `packages/ui/src/components/flag-icon.tsx` or an inline emoji fallback — decide by
  looking at what legacy's `FlagIcon` actually renders before adding an asset pipeline
- Modify: `apps/web/src/shell/topbar.tsx`, `apps/web/package.json`

## Implementation Steps

1. Add `i18next` and `react-i18next`; initialise with `en` only and a lazy loader for the rest.
   **Done** — the six locale bundles build as separate 1.5 kB chunks.
2. `config.ts`: the seven display names and the flag map, copied from legacy so the three
   non-obvious mappings survive.
3. `language-store.ts`: read `localStorage.language` on boot, write on change, set
   `document.documentElement.lang`. Guard a stored value that is no longer a known locale.
4. `language-switcher.tsx`: the dropdown, with untranslated locales carrying a dim marker.
5. Seed `en.json` with the strings the shell and the scan list already hardcode; convert those
   two areas to keys. **Do not convert the create-scan flow** — the redesign plan rewrites it,
   and keys written now would be rewritten with it.
6. Test: persistence across reload; an unknown stored locale falls back; the `lang` attribute
   follows the selection.

## Tests / Validation

- `pnpm --filter @scanvault/web test`, `-w typecheck`, `lint`, `build`
- Check the built output: the six unseeded locales must not be in the main chunk

## Risk Assessment

- **A half-converted app is worse than an unconverted one** if the boundary is unclear. The
  boundary here is explicit: shell and scan list now, create-scan after its redesign, and the
  seeded `en.json` is the record of what has been converted.
- ~~**Shipping six selectable languages that do not translate anything.**~~ **Does not arise.**
  All six carry real translations for the shared vocabulary — see the correction above.
- ~~**`fil` has no flag in most icon sets.**~~ **Does not arise.** No icon set is used: the flag
  is two regional-indicator codepoints derived from the country code, so `ph` renders like any
  other. Where a platform has no flag glyph (Windows Chrome) it draws the two letters, which
  still says which country.
- Rollback: revert; strings return to literals since the keys and the fallbacks both resolve to
  English text.
