import { courseKeys, scanKeys } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { visibleNavGroups } from '../nav-config';
import {
  cachedCourseCommands,
  cachedScanCommands,
  commandSources,
  navCommands,
  type CachedQuery,
} from './command-sources';

const translate = (key: string) => key;

function user(permissions: string[]) {
  return {
    id: 'u1',
    email: 'u@sector.test',
    userName: 'u',
    firstName: null,
    lastName: null,
    role: { id: 'r1', name: 'Role', slug: 'role', permissions },
  } as Parameters<typeof visibleNavGroups>[0];
}

describe('navCommands', () => {
  it('offers only what the rail would show this role', () => {
    // The menu reads the same predicate the rail does, so a learner cannot be
    // offered a destination their sidebar does not have.
    const learner = navCommands(visibleNavGroups(user([])), translate);

    expect(learner.map((entry) => entry.id)).not.toContain('nav:group-administration');
  });

  it('offers group administration to a role that holds the permission', () => {
    const admin = navCommands(visibleNavGroups(user(['read:group'])), translate);

    expect(admin.map((entry) => entry.id)).toContain('nav:group-administration');
  });

  it('carries the section as a hint, except for the unlabelled home group', () => {
    const entries = navCommands(visibleNavGroups(user([])), translate);

    expect(entries.find((entry) => entry.id === 'nav:home')?.hint).toBeNull();
    expect(entries.find((entry) => entry.id === 'nav:courses')?.hint).toBe('nav.learn');
  });
});

describe('cachedScanCommands', () => {
  const scan = (id: string, title: string) => ({
    id,
    title,
    scanIdentifier: `ID-${id}`,
    scanType: { id: 'st', name: 'FAST' },
  });

  it('reads scans out of a cached list page and links to that view', () => {
    const entries: CachedQuery[] = [
      [scanKeys.list('expert', {}), { items: [scan('s1', 'Gallbladder study')] }],
    ];

    const [command] = cachedScanCommands(entries);

    expect(command?.label).toBe('Gallbladder study');
    expect(command?.hint).toBe('ID-s1');
    expect(command?.path).toContain('/scans/expert/');
    expect(command?.path).toContain('s1');
  });

  it('shows one row for a scan that sits in two cached lists', () => {
    // A reviewer who has opened both queues holds the same scan twice.
    const entries: CachedQuery[] = [
      [scanKeys.list('pending', {}), { items: [scan('s1', 'Lung study')] }],
      [scanKeys.list('reviewed', {}), { items: [scan('s1', 'Lung study')] }],
    ];

    expect(cachedScanCommands(entries)).toHaveLength(1);
  });

  it('ignores a cache row that is not a scan list', () => {
    expect(cachedScanCommands([[courseKeys.list({}), { items: [scan('s1', 'x')] }]])).toEqual([]);
  });

  it('yields nothing for a cold cache', () => {
    expect(cachedScanCommands([])).toEqual([]);
    expect(cachedScanCommands([[scanKeys.list('my', {}), undefined]])).toEqual([]);
  });
});

describe('cachedCourseCommands', () => {
  const enrolment = (id: string, title: string) => ({ id: `e-${id}`, course: { id, title } });

  it('links a cached enrolment to its course page', () => {
    const entries: CachedQuery[] = [
      [courseKeys.list({}), { items: [enrolment('c1', 'POCUS Basics')] }],
    ];

    expect(cachedCourseCommands(entries)[0]).toMatchObject({
      group: 'course',
      label: 'POCUS Basics',
      path: '/learn/courses/c1',
    });
  });

  it('shows one row for a course cached on two pages', () => {
    const entries: CachedQuery[] = [
      [courseKeys.list({ page: 1 }), { items: [enrolment('c1', 'POCUS Basics')] }],
      [courseKeys.list({ page: 2 }), { items: [enrolment('c1', 'POCUS Basics')] }],
    ];

    expect(cachedCourseCommands(entries)).toHaveLength(1);
  });
});

describe('commandSources', () => {
  it('returns navigation first, then scans, then courses', () => {
    const items = commandSources({
      navGroups: visibleNavGroups(user([])),
      scanQueries: [[scanKeys.list('my', {}), { items: [{ id: 's1', title: 'Scan' }] }]],
      courseQueries: [
        [courseKeys.list({}), { items: [{ id: 'e', course: { id: 'c', title: 'C' } }] }],
      ],
      translate,
    });

    const groups = [...new Set(items.map((entry) => entry.group))];

    expect(groups).toEqual(['nav', 'scan', 'course']);
  });
});
