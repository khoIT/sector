import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The group detail heading must come from the route, not from navigation
 * state.
 *
 * The regression: every panel read `location.state.groupName` and fell back to
 * `t('groups.members.title')` — the literal string "Members". `navigate(path)`
 * in the tab bar sends no state, so switching to Courses, Assignments, Exports
 * or Settings titled the page "Members", as did any direct link. The cold-load
 * sweep could not catch it because the sweep navigates by URL, which is the
 * stateless path: it only ever saw the fallback and its `needs` pattern
 * matched it anyway.
 */

const FEATURE_DIR = fileURLToPath(new URL('.', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !entry.endsWith('.test.ts') ? [full] : [];
  });
}

/**
 * Comments are stripped before scanning: the doc comments on
 * `use-group-detail-title.ts` and `group-detail-tabs.tsx` explain the bug, and
 * naming it is the point of them. Only real code counts as an offender.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = sourceFiles(FEATURE_DIR).map((path) => ({
  path: path.slice(FEATURE_DIR.length),
  source: withoutComments(readFileSync(path, 'utf8')),
}));

const TAB_PANELS = [
  'members/members-surface.tsx',
  'forms/group-courses-panel.tsx',
  'forms/group-assignments-panel.tsx',
  'exports/group-exports-panel.tsx',
  'settings/group-settings-page.tsx',
];

describe('group detail title', () => {
  it('found the panels it means to check', () => {
    const paths = files.map((file) => file.path);
    for (const panel of TAB_PANELS) expect(paths).toContain(panel);
  });

  it.each(TAB_PANELS)('%s resolves its title from the route', (panel) => {
    const source = files.find((file) => file.path === panel)?.source ?? '';

    expect(source).toMatch(/useGroupDetailTitle\(groupId\)/);
  });

  it('no group surface reads a group name out of navigation state', () => {
    const offenders = files
      .filter((file) => /location\.state/.test(file.source) || /groupName/.test(file.source))
      .map((file) => file.path);

    expect(offenders).toEqual([]);
  });

  it('no group surface falls back to the members heading for a generic title', () => {
    const offenders = files
      .filter((file) => file.source.includes("t('groups.members.title')"))
      .map((file) => file.path);

    expect(offenders).toEqual([]);
  });

  it('the tab bar navigates without trying to carry state along', () => {
    const tabs = files.find((file) => file.path === 'group-detail-tabs.tsx')?.source ?? '';

    expect(tabs).toMatch(/navigate\(target\.path\)/);
    expect(tabs).not.toMatch(/navigate\([^)]*state:/);
  });
});
