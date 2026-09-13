/**
 * Resolve the three conflicts every phase merge produces in this repo.
 *
 * Phases are built in parallel worktrees and each one appends to the same few
 * shared files, so the same conflicts recur on every merge and the resolution
 * is always the same decision:
 *
 *   - The seven locale files merge as a UNION of namespaces. Two phases adding
 *     different namespaces is not a disagreement. A key both sides changed to
 *     different values IS one, and this refuses to guess: it reports the key
 *     and leaves the file conflicted.
 *   - `index.ts` and `fidelity/manifest.ts` take append-only blocks, so both
 *     sides are kept, ours first.
 *   - `cold-load-sweep.mjs` keeps the branch's copy. Three agents parametrised
 *     it independently under three different variable names; the one on the
 *     integration branch is the one the committed route list and README match.
 *
 * Run from the repo root with a merge in progress. Anything it cannot decide
 * is left for a human, which is the point.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const conflicted = git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
if (conflicted.length === 0) {
  console.log('No conflicted paths. Nothing to do.');
  process.exit(0);
}

const stage = (n, path) => JSON.parse(git('show', `:${n}:${path}`));
const leaves = (o) =>
  Object.values(o).reduce((n, v) => n + (v && typeof v === 'object' ? leaves(v) : 1), 0);

/** Three-way union. Returns [merged, conflictingKeyPaths]. */
function unite(base, ours, theirs, trail = []) {
  const out = { ...ours };
  const clashes = [];
  for (const [key, theirValue] of Object.entries(theirs)) {
    const here = [...trail, key];
    if (!(key in ours)) {
      out[key] = theirValue;
      continue;
    }
    const ourValue = ours[key];
    const baseValue = base && typeof base === 'object' ? base[key] : undefined;
    if (isPlain(ourValue) && isPlain(theirValue)) {
      const [merged, inner] = unite(
        isPlain(baseValue) ? baseValue : {},
        ourValue,
        theirValue,
        here,
      );
      out[key] = merged;
      clashes.push(...inner);
    } else if (JSON.stringify(ourValue) !== JSON.stringify(theirValue)) {
      // Whichever side left the base value alone loses; if both moved, stop.
      if (JSON.stringify(ourValue) === JSON.stringify(baseValue)) out[key] = theirValue;
      else if (JSON.stringify(theirValue) !== JSON.stringify(baseValue))
        clashes.push(here.join('.'));
    }
  }
  return [out, clashes];
}
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

let unresolved = 0;
for (const path of conflicted) {
  if (/i18n\/locales\/[a-z]+\.json$/.test(path)) {
    let base = {};
    try {
      base = stage(1, path);
    } catch {
      /* added on both sides, no common ancestor */
    }
    const [merged, clashes] = unite(base, stage(2, path), stage(3, path));
    if (clashes.length > 0) {
      console.log(`${path}: LEFT CONFLICTED — both sides changed ${clashes.join(', ')}`);
      unresolved += clashes.length;
      continue;
    }
    writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`);
    git('add', path);
    console.log(`${path}: united, ${leaves(merged)} keys`);
  } else if (path.endsWith('scripts/check/cold-load-sweep.mjs')) {
    git('checkout', '--ours', '--', path);
    git('add', path);
    console.log(`${path}: kept the integration branch's copy`);
  } else if (/(index|manifest)\.ts$/.test(path)) {
    const text = readFileSync(path, 'utf8');
    const blocks = /<<<<<<< [^\n]*\n([\s\S]*?)\n?=======\n([\s\S]*?)>>>>>>> [^\n]*\n/g;
    const count = (text.match(/^<<<<<<< /gm) ?? []).length;
    const joined = text.replace(blocks, (_, ours, theirs) => `${ours}\n${theirs}`);
    if (joined.includes('<<<<<<<')) {
      console.log(`${path}: LEFT CONFLICTED — a block did not match the append shape`);
      unresolved += 1;
      continue;
    }
    writeFileSync(path, joined);
    git('add', path);
    console.log(`${path}: kept both append blocks (${count})`);
  } else {
    console.log(`${path}: LEFT CONFLICTED — no rule for this file, resolve it yourself`);
    unresolved += 1;
  }
}
console.log(unresolved === 0 ? '\nAll conflicts resolved.' : `\n${unresolved} left for you.`);
process.exit(unresolved === 0 ? 0 : 1);
