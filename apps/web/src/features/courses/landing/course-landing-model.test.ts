import { describe, expect, it } from 'vitest';

import type { CourseOutlineItem } from '@sector/api-client';

import {
  ctaLabelKey,
  formatTotalTime,
  landingBlocks,
  outlineKindCounts,
} from './course-landing-model';

const EMPTY_COURSE = {
  content: undefined,
  level: null,
  objectives: [],
  cmeCredits: null,
} as const;

describe('landingBlocks', () => {
  it('hides every block for a course nobody has written anything for', () => {
    expect(landingBlocks(EMPTY_COURSE, { totalSeconds: null })).toEqual({
      description: false,
      level: false,
      objectives: false,
      totalTime: false,
      cme: false,
    });
  });

  it('treats markup with no words in it as no description', () => {
    // What a CMS leaves behind when an editor clears the field.
    expect(
      landingBlocks({ ...EMPTY_COURSE, content: '<p></p>' }, { totalSeconds: null }).description,
    ).toBe(false);
    expect(
      landingBlocks({ ...EMPTY_COURSE, content: '<p>&nbsp;</p>' }, { totalSeconds: null })
        .description,
    ).toBe(false);
    expect(
      landingBlocks({ ...EMPTY_COURSE, content: '<p>Real text</p>' }, { totalSeconds: null })
        .description,
    ).toBe(true);
  });

  it('ignores objectives that are only whitespace', () => {
    expect(
      landingBlocks({ ...EMPTY_COURSE, objectives: ['  ', ''] }, { totalSeconds: null }).objectives,
    ).toBe(false);
    expect(
      landingBlocks(
        { ...EMPTY_COURSE, objectives: ['Acquire a PLAX view'] },
        { totalSeconds: null },
      ).objectives,
    ).toBe(true);
  });

  it('requires credits for the CME block, not just a code', () => {
    // All 93 courses carrying CME keys hold the empty string in every one of
    // them, so an empty string must not open the block.
    expect(landingBlocks({ ...EMPTY_COURSE, cmeCredits: '' }, { totalSeconds: null }).cme).toBe(
      false,
    );
    expect(landingBlocks({ ...EMPTY_COURSE, cmeCredits: '1.5' }, { totalSeconds: null }).cme).toBe(
      true,
    );
  });

  it('shows total time only when the outline knows a runtime', () => {
    expect(landingBlocks(EMPTY_COURSE, { totalSeconds: null }).totalTime).toBe(false);
    expect(landingBlocks(EMPTY_COURSE, { totalSeconds: 0 }).totalTime).toBe(false);
    expect(landingBlocks(EMPTY_COURSE, { totalSeconds: 60 }).totalTime).toBe(true);
  });
});

describe('formatTotalTime', () => {
  it('says nothing rather than zero when no runtime is known', () => {
    expect(formatTotalTime(null)).toBeNull();
  });

  it('formats hours and minutes the way the outline chips do', () => {
    expect(formatTotalTime(13200)).toBe('3h 40m');
  });
});

describe('ctaLabelKey', () => {
  it('reuses the course card verbs rather than inventing a fourth set', () => {
    expect(ctaLabelKey('not_started')).toBe('courses.index.action.start');
    expect(ctaLabelKey('in_progress')).toBe('courses.index.action.resume');
    expect(ctaLabelKey('completed')).toBe('courses.index.action.review');
  });
});

function outlineItem(
  overrides: Partial<CourseOutlineItem> & Pick<CourseOutlineItem, 'id'>,
): CourseOutlineItem {
  return {
    kind: 'lesson',
    title: overrides.id,
    order: 0,
    depth: 0,
    parentId: null,
    lessonId: null,
    topicId: null,
    prevId: null,
    nextId: null,
    status: 'not_started',
    completedAt: null,
    lastAccessedAt: null,
    blockedReason: null,
    quiz: null,
    positionSeconds: null,
    durationSeconds: null,
    imageUrl: null,
    ...overrides,
  };
}

describe('outlineKindCounts', () => {
  it('counts modules, topics and quizzes separately, with their done tallies', () => {
    const counts = outlineKindCounts([
      outlineItem({ id: 'm1', depth: 0, status: 'completed' }),
      outlineItem({ id: 't1', kind: 'topic', depth: 1, status: 'completed' }),
      outlineItem({ id: 't2', kind: 'topic', depth: 1 }),
      outlineItem({ id: 'q1', kind: 'quiz', depth: 1, status: 'completed' }),
      outlineItem({ id: 'm2', depth: 0 }),
    ]);

    expect(counts).toEqual({
      modules: 2,
      modulesDone: 1,
      topics: 2,
      topicsDone: 1,
      quizzes: 1,
      quizzesDone: 1,
    });
  });

  it('leaves a blocked quiz out of both halves', () => {
    // A published quiz with no questions cannot be opened, so counting it
    // leaves a denominator nobody can ever move — a finished course that
    // reads as unfinished forever.
    const counts = outlineKindCounts([
      outlineItem({ id: 'm1', depth: 0, status: 'completed' }),
      outlineItem({ id: 'q1', kind: 'quiz', depth: 1, blockedReason: 'quiz_has_no_questions' }),
    ]);

    expect(counts.quizzes).toBe(0);
    expect(counts.quizzesDone).toBe(0);
  });

  it('counts a depth-0 topic as a module, because that is the row the page draws', () => {
    // The fourth nesting shape: course > topic > quiz, with no lesson at all.
    const counts = outlineKindCounts([
      outlineItem({ id: 't1', kind: 'topic', depth: 0 }),
      outlineItem({ id: 'q1', kind: 'quiz', depth: 1 }),
    ]);

    expect(counts.modules).toBe(1);
    expect(counts.topics).toBe(0);
    expect(counts.quizzes).toBe(1);
  });
});
