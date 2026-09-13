import { describe, expect, it } from 'vitest';

import {
  allQuestionsAnswered,
  answeredCount,
  isQuestionAnswered,
  selectSingleAnswer,
  toggleMultipleAnswer,
} from './answers';
import type { QuizQuestion } from './types';

const question = (id: string, answerType: QuizQuestion['answerType'] = 'single'): QuizQuestion => ({
  id,
  title: `Question ${id}`,
  content: '',
  answerType,
  answers: [],
  correctMessage: '',
  incorrectMessage: '',
  points: 1,
});

describe('selectSingleAnswer', () => {
  it('replaces the whole selection with the one id chosen', () => {
    const answers = selectSingleAnswer({ q1: ['old'] }, 'q1', 'new');
    expect(answers.q1).toEqual(['new']);
  });

  it('does not disturb other questions', () => {
    const answers = selectSingleAnswer({ q2: ['x'] }, 'q1', 'a');
    expect(answers.q2).toEqual(['x']);
  });
});

describe('toggleMultipleAnswer', () => {
  it('adds an id not yet selected', () => {
    expect(toggleMultipleAnswer({}, 'q1', 'a').q1).toEqual(['a']);
    expect(toggleMultipleAnswer({ q1: ['a'] }, 'q1', 'b').q1).toEqual(['a', 'b']);
  });

  it('removes an id already selected', () => {
    expect(toggleMultipleAnswer({ q1: ['a', 'b'] }, 'q1', 'a').q1).toEqual(['b']);
  });

  it('can toggle a question down to no selection at all', () => {
    expect(toggleMultipleAnswer({ q1: ['a'] }, 'q1', 'a').q1).toEqual([]);
  });
});

describe('isQuestionAnswered', () => {
  it('is false for a missing entry and for an empty array', () => {
    expect(isQuestionAnswered({}, 'q1')).toBe(false);
    expect(isQuestionAnswered({ q1: [] }, 'q1')).toBe(false);
  });

  it('is true once at least one id is selected', () => {
    expect(isQuestionAnswered({ q1: ['a'] }, 'q1')).toBe(true);
  });
});

describe('answeredCount / allQuestionsAnswered', () => {
  const questions = [question('q1'), question('q2'), question('q3')];

  it('counts only the questions with a real selection', () => {
    expect(answeredCount({ q1: ['a'], q2: [] }, questions)).toBe(1);
  });

  it('is fully answered only once every question has a selection', () => {
    expect(allQuestionsAnswered({ q1: ['a'], q2: ['b'] }, questions)).toBe(false);
    expect(allQuestionsAnswered({ q1: ['a'], q2: ['b'], q3: ['c'] }, questions)).toBe(true);
  });

  it('a zero-question quiz is never "fully answered" — there is nothing to finish', () => {
    expect(allQuestionsAnswered({}, [])).toBe(false);
  });
});
