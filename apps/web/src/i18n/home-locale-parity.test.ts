import { describe, expect, it } from 'vitest';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fil from './locales/fil.json';
import fr from './locales/fr.json';
import italian from './locales/it.json';
import pt from './locales/pt.json';

/**
 * Every key the home-screen dashboards introduced, translated for real in all
 * six non-English locales — same scoping as `locale-key-parity.test.ts`: this
 * checks the keys THIS phase added, not full-resource parity (a large,
 * separate, pre-existing gap that predates this work).
 */
const NEW_NAV_KEYS = ['home'] as const;

const NEW_HOME_KEYS = [
  'greeting',
  'courseStatus.inProgress',
  'courseStatus.completed',
  'courseStatus.notStarted',
  'myLearning.title',
  'myLearning.course',
  'myLearning.selectCourse',
  'myLearning.courseProgress',
  'myLearning.noCourseProgress',
  'myLearning.scanProgress',
  'myLearning.noScanProgress',
  'myLearning.qbank',
  'myLearning.noQbank',
  'myLearning.attempts_one',
  'myLearning.attempts_other',
  'myLearning.timeline',
  'myLearning.noTimeline',
  'myLearning.topCourses',
  'myLearning.noTopCourses',
  'myLearning.topics',
  'myLearning.noTopics',
  'myLearning.quizzes',
  'myLearning.noQuizzes',
  'leader.title',
  'leader.group',
  'leader.noGroup',
  'leader.noGroupHint',
  'group.title',
  'group.viewMembers',
  'group.courseProgress',
  'group.noCourseProgress',
  'group.scanProgress',
  'group.noScanProgress',
  'group.qbank',
  'group.noQbank',
  'group.averageScore',
  'reviewer.title',
  'reviewer.expertUnreviewed',
  'reviewer.expertReviewed',
  'reviewer.groupUnreviewed',
  'reviewer.groupReviewed',
  'reviewer.credits',
  'reviewer.personalCredits',
  'reviewer.creditsUnavailable',
  'reviewer.loading',
  'admin.title',
  'admin.manageGroups',
  'admin.group',
  'admin.selectGroup',
  'admin.noGroups',
  'admin.noGroupsHint',
] as const;

const LOCALES: Record<string, Record<string, unknown>> = { de, es, fil, fr, it: italian, pt };

function getPath(resource: Record<string, unknown>, namespace: string, dottedKey: string): unknown {
  let cursor: unknown = resource[namespace];
  for (const segment of dottedKey.split('.')) {
    if (typeof cursor !== 'object' || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

describe('i18n key parity for the home-screen dashboards', () => {
  it('finds every new key in English first, so a typo here fails loudly', () => {
    for (const key of NEW_NAV_KEYS) expect(getPath(en, 'nav', key)).toBeTypeOf('string');
    for (const key of NEW_HOME_KEYS) expect(getPath(en, 'home', key)).toBeTypeOf('string');
  });

  for (const [locale, resource] of Object.entries(LOCALES)) {
    describe(locale, () => {
      it('translates every new nav.* key', () => {
        for (const key of NEW_NAV_KEYS) {
          const value = getPath(resource, 'nav', key);
          expect(value, `nav.${key}`).toBeTypeOf('string');
          expect((value as string).length, `nav.${key}`).toBeGreaterThan(0);
        }
      });

      it('translates every new home.* key', () => {
        for (const key of NEW_HOME_KEYS) {
          const value = getPath(resource, 'home', key);
          expect(value, `home.${key}`).toBeTypeOf('string');
          expect((value as string).length, `home.${key}`).toBeGreaterThan(0);
        }
      });

      it('does not just repeat the English string verbatim', () => {
        const mismatches: string[] = [];
        for (const key of NEW_HOME_KEYS) {
          const englishValue = getPath(en, 'home', key) as string;
          const localValue = getPath(resource, 'home', key) as string;
          if (englishValue.length > 20 && englishValue === localValue) {
            mismatches.push(`home.${key}`);
          }
        }
        expect(mismatches).toEqual([]);
      });
    });
  }
});
