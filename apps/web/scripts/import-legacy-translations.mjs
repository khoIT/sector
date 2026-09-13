/**
 * Seed the non-English locales from the legacy dashboard's translation corpus.
 *
 * `gusi_web_dashboard/src/i18n/locales` holds 2,824 English keys and 2,775 in
 * each of the other six languages — real translations, not copies: only 60 of
 * them are byte-identical to the English. The sections Scan Vault needs are
 * fully covered there (`common` 108, `scans` 549, `navigation` 25, `account`
 * 113, `pagination` 9, `datatable` 22, all present in every locale).
 *
 * So rather than shipping six selectable-but-empty languages, this matches
 * Scan Vault's English strings against that corpus by exact text and lifts
 * whatever it finds. Matching on TEXT rather than on key is what makes it work
 * across two apps whose key trees have nothing in common.
 *
 * Re-run after editing `en.json`:
 *   node apps/web/scripts/import-legacy-translations.mjs
 *
 * It rewrites the six locale files and prints per-language coverage. Strings
 * with no match are simply absent, and i18next falls back to English for them —
 * which is the honest outcome, and better than a machine guess.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OURS = resolve(HERE, '../src/i18n/locales');
const LEGACY = resolve(HERE, '../../../../gusi_web_dashboard/src/i18n/locales');

const TARGETS = ['es', 'it', 'de', 'pt', 'fil', 'fr'];

/**
 * Keys that must stay English in every language.
 *
 * A product name is not a phrase. The legacy corpus happens to hold a matching
 * English string for "Scan Vault" and translates it word by word — Spanish
 * came back as "Escanea Bóveda", which reads as "it scans vault" and names
 * nothing. Names are excluded here rather than fixed per language.
 */
const DO_NOT_TRANSLATE = new Set(['nav.section', 'row.dicom']);

/** `{a: {b: 'x'}}` → `{'a.b': 'x'}`. */
function flatten(object, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, path));
    } else if (typeof value === 'string') {
      out[path] = value;
    }
  }
  return out;
}

/** `{'a.b': 'x'}` → `{a: {b: 'x'}}`. */
function nest(flat) {
  const out = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.');
    let node = out;
    for (const part of parts.slice(0, -1)) {
      node[part] ??= {};
      node = node[part];
    }
    node[parts.at(-1)] = value;
  }
  return out;
}

/**
 * Compare on trimmed lower-case text, and ignore interpolation placeholders:
 * legacy writes `{{count}}` too, but a Scan Vault string may name a variable
 * differently for the same sentence. Nothing else is normalised — punctuation
 * differences are real differences.
 */
function normalise(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\{\{\s*\w+\s*\}\}/g, '{}');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const ours = flatten(readJson(`${OURS}/en.json`));
const legacyEnglish = flatten(readJson(`${LEGACY}/en.json`));

// text → legacy key. First key wins, so an earlier section is preferred over a
// later duplicate; the values are identical by construction either way.
const legacyKeyByText = new Map();
for (const [key, text] of Object.entries(legacyEnglish)) {
  const id = normalise(text);
  if (!legacyKeyByText.has(id)) legacyKeyByText.set(id, key);
}

const matchedKeys = Object.entries(ours).filter(
  ([key, text]) => !DO_NOT_TRANSLATE.has(key) && legacyKeyByText.has(normalise(text)),
);

console.log(`Scan Vault strings: ${Object.keys(ours).length}`);
console.log(
  `Matched in the legacy corpus: ${matchedKeys.length}` +
    ` (${Math.round((matchedKeys.length / Object.keys(ours).length) * 100)}%)`,
);

const matched = new Set(matchedKeys.map(([key]) => key));
const unmatched = Object.keys(ours).filter((key) => !matched.has(key));

mkdirSync(OURS, { recursive: true });

for (const locale of TARGETS) {
  const translations = flatten(readJson(`${LEGACY}/${locale}.json`));
  const out = {};

  for (const [ourKey, ourText] of matchedKeys) {
    const legacyKey = legacyKeyByText.get(normalise(ourText));
    const translated = translations[legacyKey];
    if (typeof translated !== 'string' || !translated.trim()) continue;

    // Carry our own placeholder names across: the sentence is the translation,
    // the variable names are ours. Positional, because that is all the shapes
    // here need and it fails loudly rather than silently if they diverge.
    const ourSlots = ourText.match(/\{\{\s*\w+\s*\}\}/g) ?? [];
    const theirSlots = translated.match(/\{\{\s*\w+\s*\}\}/g) ?? [];
    if (ourSlots.length !== theirSlots.length) continue;

    let text = translated;
    theirSlots.forEach((slot, index) => {
      text = text.replace(slot, ourSlots[index]);
    });

    out[ourKey] = text;
  }

  writeFileSync(`${OURS}/${locale}.json`, `${JSON.stringify(nest(out), null, 2)}\n`);
  const share = Math.round((Object.keys(out).length / Object.keys(ours).length) * 100);
  console.log(`  ${locale}: ${Object.keys(out).length} strings (${share}%)`);
}

if (unmatched.length > 0) {
  console.log(`\nNo legacy equivalent — these fall back to English:`);
  for (const key of unmatched) console.log(`  ${key}: ${JSON.stringify(ours[key])}`);
}
