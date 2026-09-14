import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Guards on the group-administration writes that change or remove someone's
 * access. These are source-level assertions, the same approach
 * `app/storage-migration.test.ts` takes, because the web package runs vitest
 * in a node environment with no DOM: a dialog's Escape handling and a
 * mutation's error rendering cannot be exercised here, but their absence can
 * be detected, and that absence is what shipped.
 *
 * Each `it` below names the specific regression it exists to catch.
 */

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const confirmDialog = read('./confirm-action-dialog.tsx');
const memberActions = read('./members/member-actions-cell.tsx');
const coursesPanel = read('./forms/group-courses-panel.tsx');
const exportsPanel = read('./exports/group-exports-panel.tsx');

describe('ConfirmActionDialog', () => {
  // The regression: `onOpenChange={setConfirmOpen}` with no guard. Escape, an
  // overlay click and DialogContent's own close button all route through it,
  // and the error is rendered inside the content, so a dialog that closes
  // mid-request takes the only report of the failure with it.
  it('refuses to close while the request is in flight', () => {
    expect(confirmDialog).toMatch(/onOpenChange=\{\(next\) => \{\s*if \(isPending\) return;/);
  });

  it('disables both footer buttons while pending, so neither fires twice', () => {
    const disabled = confirmDialog.match(/disabled=\{isPending\}/g) ?? [];
    expect(disabled.length).toBe(2);
  });

  it('renders the error it is given, rather than only accepting it', () => {
    expect(confirmDialog).toMatch(/\{error \?/);
  });
});

describe('member actions', () => {
  // The regression: the role change fired straight out of onValueChange, with
  // no confirmation. Promoting a learner to leader is a permission grant.
  it('routes the role change through a confirmation, not onValueChange', () => {
    expect(memberActions).not.toMatch(/onValueChange=\{[^}]*mutate\(/);
    expect(memberActions).toMatch(/requestRoleChange/);
    expect(memberActions).toMatch(/<ConfirmActionDialog/);
  });

  // The regression: only removeMember.isError was ever rendered. A failed role
  // change reverted the select and said nothing.
  it('renders an error for the role change as well as the removal', () => {
    expect(memberActions).toMatch(/updateRole\.isError/);
    expect(memberActions).toMatch(/removeMember\.isError/);
  });

  it('resets each mutation when its dialog closes, so a stale failure cannot reappear', () => {
    expect(memberActions).toMatch(/updateRole\.reset\(\)/);
    expect(memberActions).toMatch(/removeMember\.reset\(\)/);
  });

  // The regression: a fixed confirmation string in a roster that runs to 719
  // rows, so every row's prompt looked identical.
  it('names the member in both confirmations', () => {
    expect(memberActions).toMatch(/values=\{\{ name \}\}/);
  });

  it('builds the role payload through the model that preserves expiresAt', () => {
    expect(memberActions).toMatch(/roleChangePayloadFor\(member, pendingRole\)/);
  });
});

describe('group courses', () => {
  // The regression: `onClick={() => removeCourse.mutate(course.id)}` — one
  // click un-enrolled every member of the group, and removeCourse.isError was
  // never read anywhere in the file.
  it('confirms before removing a course', () => {
    expect(coursesPanel).not.toMatch(/onClick=\{\(\) => removeCourse\.mutate\(/);
    expect(coursesPanel).toMatch(/<ConfirmActionDialog/);
  });

  it('renders the removal failure', () => {
    expect(coursesPanel).toMatch(/removeCourse\.isError/);
  });

  it('resets the mutation when the dialog closes', () => {
    expect(coursesPanel).toMatch(/removeCourse\.reset\(\)/);
  });
});

describe('exports', () => {
  // The regression: `error={isApiError(x.error) ? x.error.message : undefined}`
  // rendered nothing for a non-ApiError, and a decode that threw after a
  // successful request was caught by an empty block that pointed at an
  // isError flag which was false.
  it('never gates a rendered message on isApiError', () => {
    expect(exportsPanel).not.toMatch(/isApiError/);
  });

  it('reports a decode failure separately from the request failure', () => {
    expect(exportsPanel).toMatch(/setDownloadError\(\{ card, message: errorMessage\(/);
    expect(exportsPanel).toMatch(/decodeErrorFor\(/);
  });

  it('attributes a decode failure to the card that produced it', () => {
    for (const card of ['scans', 'userScans', 'courseProgress', 'courseData']) {
      expect(exportsPanel).toContain(`decodeErrorFor('${card}')`);
    }
  });
});
