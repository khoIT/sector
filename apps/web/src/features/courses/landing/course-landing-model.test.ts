import { describe, expect, it } from 'vitest';

import { ctaLabelKey, formatTotalTime, landingBlocks } from './course-landing-model';

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
