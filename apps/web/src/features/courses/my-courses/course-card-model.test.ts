import { learnerCourseListItemSchema, type LearnerCourseListItem } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { courseCardModel, excerptFromHtml } from './course-card-model';

describe('excerptFromHtml', () => {
  it('keeps the words and drops the markup', () => {
    expect(excerptFromHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('separates text the tags kept apart', () => {
    // Stripping a tag to nothing joins two words into one; stripping it to a
    // space does not.
    expect(excerptFromHtml('<p>First</p><p>Second</p>')).toBe('First Second');
  });

  it('treats markup with no words in it as no description', () => {
    // The same absent-vs-empty rule the course page runs on, from the same
    // helper — a CMS leaves `<p></p>` behind, and WordPress leaves `&nbsp;`.
    expect(excerptFromHtml('<p></p>')).toBeNull();
    expect(excerptFromHtml('&nbsp;')).toBeNull();
    expect(excerptFromHtml('   ')).toBeNull();
    expect(excerptFromHtml(null)).toBeNull();
    expect(excerptFromHtml(undefined)).toBeNull();
  });

  it('clamps a long description on a word boundary', () => {
    const text = 'lorem ipsum dolor sit amet '.repeat(20).trim();

    const excerpt = excerptFromHtml(`<p>${text}</p>`);

    expect(excerpt).not.toBeNull();
    expect(excerpt!.length).toBeLessThanOrEqual(141);
    expect(excerpt!.endsWith('…')).toBe(true);
    // Cut between words, not through one.
    expect(excerpt!.slice(0, -1)).toBe(excerpt!.slice(0, -1).trimEnd());
    expect(text.startsWith(excerpt!.slice(0, -1))).toBe(true);
  });

  it('cuts a single over-long word rather than returning all of it', () => {
    const excerpt = excerptFromHtml('x'.repeat(400));

    expect(excerpt).toHaveLength(141);
  });

  it('leaves a description already under the limit alone', () => {
    expect(excerptFromHtml('<p>Short enough.</p>')).toBe('Short enough.');
  });
});

function listItem(overrides: {
  content?: string;
  imageUrl?: string | null;
  totals?: { totalLessons: number; totalTopics: number; totalQuiz: number };
  status?: 'not_started' | 'in_progress' | 'completed';
  progress?: number;
  expiresAt?: string | null;
  lastAccessedAt?: string | null;
}): LearnerCourseListItem {
  // Parsed through the wire schema rather than cast: a hand-built object that
  // drifts from the response shape makes this test pass against something the
  // API never sends.
  return learnerCourseListItemSchema.parse({
    id: 'enrolment-1',
    assignmentType: 'personal',
    group: null,
    course: {
      id: 'course-1',
      title: 'Fundamentals of POCUS',
      slug: 'fundamentals',
      content: overrides.content,
      imageUrl: overrides.imageUrl ?? null,
      objectives: [],
      status: 'published',
      author: { _id: 'author-1', email: 'author@sector.test', firstName: 'A', lastName: 'Author' },
    },
    progress: {
      status: overrides.status ?? 'in_progress',
      progress: overrides.progress ?? 42.4,
      totalItems: 0,
      completedItems: 0,
      completedLessons: 0,
      completedTopics: 0,
      completedQuizzes: 0,
      totalTimeSpent: 0,
      startedAt: null,
      completedAt: null,
      lastAccessedAt: overrides.lastAccessedAt ?? null,
    },
    courseMetaVersion: {
      id: 'version-1',
      version: 2,
      status: 'published',
      totalItems: 0,
      totalLessons: overrides.totals?.totalLessons ?? 4,
      totalTopics: overrides.totals?.totalTopics ?? 24,
      totalQuiz: overrides.totals?.totalQuiz ?? 20,
    },
    enrolledAt: null,
    expiresAt: overrides.expiresAt ?? null,
    userCourseStatus: 'active',
    isExpired: false,
    expirationType: null,
  });
}

describe('courseCardModel', () => {
  it('takes the counts from the version, never from a recount', () => {
    const model = courseCardModel(
      listItem({ totals: { totalLessons: 7, totalTopics: 38, totalQuiz: 38 } }),
    );

    expect(model.counts).toEqual({ lessons: 7, topics: 38, quizzes: 38 });
    expect(model.countsUnknown).toBe(false);
  });

  it('reports counts as unknown when every total is zero', () => {
    // 43 of the mirror's version documents predate these totals. Three zeroes
    // is "we do not know", not "this course is empty" — an empty course would
    // not have been published.
    const model = courseCardModel(
      listItem({ totals: { totalLessons: 0, totalTopics: 0, totalQuiz: 0 } }),
    );

    expect(model.countsUnknown).toBe(true);
  });

  it('has no cover for the 92 of 102 courses with no image', () => {
    expect(courseCardModel(listItem({ imageUrl: null })).hasCover).toBe(false);
    expect(courseCardModel(listItem({ imageUrl: 'https://img/x.png' })).hasCover).toBe(true);
  });

  it('rounds the progress the server sent and links to the course page', () => {
    const model = courseCardModel(listItem({ progress: 42.4 }));

    expect(model.percent).toBe(42);
    expect(model.href).toBe('/learn/courses/course-1');
  });

  it('keeps the card labels the status already decided', () => {
    const model = courseCardModel(listItem({ status: 'completed' }));

    expect(model.actionLabelKey).toBe('courses.index.action.review');
    expect(model.statusKey).toBe('courses.index.status.completed');
    expect(model.tone).toBe('ok');
  });

  it('carries expiry and last active through untouched, for the caller to format', () => {
    const model = courseCardModel(
      listItem({
        expiresAt: '2027-01-01T00:00:00.000Z',
        lastAccessedAt: '2026-09-01T10:00:00.000Z',
      }),
    );

    expect(model.expiresAt).toBe('2027-01-01T00:00:00.000Z');
    expect(model.lastActiveAt).toBe('2026-09-01T10:00:00.000Z');
  });
});
