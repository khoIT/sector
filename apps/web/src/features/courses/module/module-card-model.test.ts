import type { CourseOutlineItem } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { buildModuleCards } from './module-card-model';

function item(
  overrides: Partial<CourseOutlineItem> & Pick<CourseOutlineItem, 'id'>,
): CourseOutlineItem {
  return {
    kind: 'topic',
    title: overrides.id,
    order: 0,
    depth: 1,
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

describe('buildModuleCards', () => {
  it('keeps the server order and carries each child through', () => {
    const cards = buildModuleCards([
      item({ id: 'a', title: 'Probe handling', durationSeconds: 616 }),
      item({ id: 'b', title: 'Knobology', status: 'completed' }),
    ]);

    expect(cards.map((card) => card.id)).toEqual(['a', 'b']);
    expect(cards[0]).toMatchObject({ title: 'Probe handling', durationSeconds: 616 });
    expect(cards[1]!.status).toBe('completed');
  });

  it('uses the item’s own thumbnail', () => {
    const [card] = buildModuleCards([
      item({ id: 'a', imageUrl: 'https://i.vimeocdn.com/video/1409169575-abc-d_295' }),
    ]);

    expect(card!.imageUrl).toBe('https://i.vimeocdn.com/video/1409169575-abc-d_295');
  });

  it('shows no image rather than one the browser would block', () => {
    const cards = buildModuleCards([
      item({ id: 'insecure', imageUrl: 'http://i.vimeocdn.com/video/1.jpg' }),
      item({ id: 'protocol-relative', imageUrl: '//i.vimeocdn.com/video/2.jpg' }),
      item({ id: 'none', imageUrl: null }),
    ]);

    expect(cards.map((card) => card.imageUrl)).toEqual([null, null, null]);
  });

  it('reports no runtime for a quiz', () => {
    const [card] = buildModuleCards([
      item({ id: 'q', kind: 'quiz', durationSeconds: 300, quiz: null }),
    ]);

    expect(card!.durationSeconds).toBeNull();
  });

  it('carries the blocked reason so the card can refuse to link', () => {
    const [card] = buildModuleCards([
      item({ id: 'q', kind: 'quiz', blockedReason: 'quiz_has_no_questions' }),
    ]);

    expect(card!.blockedReason).toBe('quiz_has_no_questions');
  });

  it('returns nothing for a lesson with no children', () => {
    expect(buildModuleCards([])).toEqual([]);
  });
});
