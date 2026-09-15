import type { LearnerCourseListItem } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { formatPlayheadTimestamp, selectContinueLearning } from './continue-learning-model';

/**
 * Production says 58% of started courses stall under 25% and learners do not
 * come back on their own. This picks the one course the home screen offers
 * them, so the cases that matter are the ones where it would pick wrong.
 */

function row(overrides: {
  id: string;
  title?: string;
  progress?: number;
  status?: LearnerCourseListItem['progress']['status'];
  lastAccessedAt?: string | null;
  lastItemAccessed?: { id: string; title: string; positionSeconds: number | null } | null;
}): LearnerCourseListItem {
  return {
    course: {
      id: overrides.id,
      title: overrides.title ?? overrides.id,
      slug: overrides.id,
      content: null,
      imageUrl: null,
      duration: null,
      cmeCredits: null,
      cmeUrl: null,
      cmeCode: null,
      status: 'published',
      author: { id: null, firstName: null, lastName: null, userName: null },
    },
    progress: {
      status: overrides.status ?? 'in_progress',
      progress: overrides.progress ?? 30,
      totalItems: 10,
      completedItems: 3,
      completedLessons: 0,
      completedTopics: 3,
      completedQuizzes: 0,
      totalTimeSpent: 0,
      startedAt: '2026-09-01T00:00:00.000Z',
      completedAt: null,
      // `?? default` would swallow an explicitly-null lastAccessedAt, which is
      // exactly the "never started" case one of these tests needs to express.
      lastAccessedAt:
        'lastAccessedAt' in overrides ? overrides.lastAccessedAt : '2026-09-10T00:00:00.000Z',
      lastItemAccessed: overrides.lastItemAccessed ?? null,
    },
    courseMetaVersion: null,
    expiresAt: null,
  } as unknown as LearnerCourseListItem;
}

describe('selectContinueLearning', () => {
  it('offers the most recently touched course first', () => {
    // Not the closest to finishing: that buries what the learner was doing
    // five minutes ago under something abandoned at 90% last year.
    const entries = selectContinueLearning([
      row({ id: 'stale', progress: 90, lastAccessedAt: '2026-01-01T00:00:00.000Z' }),
      row({ id: 'fresh', progress: 5, lastAccessedAt: '2026-09-14T00:00:00.000Z' }),
    ]);
    expect(entries.map((e) => e.courseId)).toEqual(['fresh', 'stale']);
  });

  it('leaves out a course that was never started', () => {
    const entries = selectContinueLearning([
      row({ id: 'untouched', status: 'not_started', lastAccessedAt: null }),
    ]);
    expect(entries).toEqual([]);
  });

  it('leaves out a finished course', () => {
    const entries = selectContinueLearning([
      row({ id: 'done', status: 'completed', progress: 100 }),
    ]);
    expect(entries).toEqual([]);
  });

  it('leaves out a course at 100% that was never marked completed', () => {
    // Counter drift is real in this data; 100% is finished whatever the
    // status field says.
    expect(selectContinueLearning([row({ id: 'drifted', progress: 100 })])).toEqual([]);
  });

  it('carries the resume item and its playhead through', () => {
    const entries = selectContinueLearning([
      row({
        id: 'c',
        lastItemAccessed: { id: 'topic-1', title: 'Physics and Probes', positionSeconds: 520 },
      }),
    ]);
    expect(entries[0]?.resumeItemId).toBe('topic-1');
    expect(entries[0]?.resumeItemTitle).toBe('Physics and Probes');
    expect(entries[0]?.resumePositionSeconds).toBe(520);
  });

  it('still offers the course when the server resolved no resume item', () => {
    // A stale pointer to deleted content resolves to null; the course is
    // still worth offering, it just opens at the outline.
    const entries = selectContinueLearning([row({ id: 'c', lastItemAccessed: null })]);
    expect(entries[0]?.courseId).toBe('c');
    expect(entries[0]?.resumeItemId).toBeNull();
  });

  it('honours the limit', () => {
    const rows = ['a', 'b', 'c', 'd'].map((id, i) =>
      row({ id, lastAccessedAt: `2026-09-0${i + 1}T00:00:00.000Z` }),
    );
    expect(selectContinueLearning(rows, 2)).toHaveLength(2);
  });

  it('ranks an unparseable timestamp last instead of dropping the course', () => {
    const entries = selectContinueLearning([
      row({ id: 'bad', lastAccessedAt: 'not-a-date' }),
      row({ id: 'good', lastAccessedAt: '2026-09-14T00:00:00.000Z' }),
    ]);
    expect(entries.map((e) => e.courseId)).toEqual(['good', 'bad']);
  });
});

describe('formatPlayheadTimestamp', () => {
  it('reads as a video timestamp, not a duration', () => {
    // "resume at 8:40", where formatDurationShort would say "9m".
    expect(formatPlayheadTimestamp(520)).toBe('8:40');
    expect(formatPlayheadTimestamp(5)).toBe('0:05');
  });

  it('adds an hours field only once there is one', () => {
    expect(formatPlayheadTimestamp(3725)).toBe('1:02:05');
  });

  it('returns null for an unknown playhead', () => {
    expect(formatPlayheadTimestamp(null)).toBeNull();
    expect(formatPlayheadTimestamp(-1)).toBeNull();
    expect(formatPlayheadTimestamp(Number.NaN)).toBeNull();
  });
});
