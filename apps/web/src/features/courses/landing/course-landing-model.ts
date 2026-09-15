import type { CourseProgressStatus, LearnerCourseSummary } from '@sector/api-client';

import { courseActionLabelKey } from '../my-courses/course-row-model';
import type { OutlineSummary } from '../outline/outline-summary';
import { formatDurationShort } from '../outline/outline-summary';

/**
 * What a course landing page can honestly say about itself.
 *
 * The whole point of this file is the difference between "absent" and
 * "empty". 158 of the library's 175 courses carry no description, none has a
 * level or an objective, and all 93 courses with CME keys hold the empty
 * string in every one of them. A page that renders a heading over an empty
 * body for each of those makes a sparse course look broken; a page that
 * renders nothing at all just looks short. So every block is gated on its
 * data being genuinely present, and the page renders only the blocks that
 * pass.
 */

export type LandingBlocks = {
  description: boolean;
  level: boolean;
  objectives: boolean;
  totalTime: boolean;
  cme: boolean;
};

/**
 * A CMS leaves `<p></p>` behind when an editor clears a field, and WordPress
 * leaves `&nbsp;`. Neither is a description, so strip the markup before
 * deciding whether anything is left.
 *
 * The entity is matched in its RAW form because `content` is the one field
 * on the course that is deliberately not decoded at the schema boundary: it
 * is HTML, so it arrives with its entities intact and is sanitised at render.
 */
function hasVisibleText(html: string | null | undefined): boolean {
  if (!html) return false;
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
      .replace(/\s+/g, '').length > 0
  );
}

/**
 * Narrower than `LearnerCourseSummary` on purpose: these are the only four
 * fields the decision reads, and `objectives` is accepted read-only so a
 * caller holding a frozen fixture does not have to copy it first.
 */
export type LandingCourseFields = Pick<LearnerCourseSummary, 'content' | 'level' | 'cmeCredits'> & {
  objectives: readonly string[];
};

export function landingBlocks(
  course: LandingCourseFields,
  summary: Pick<OutlineSummary, 'totalSeconds'>,
): LandingBlocks {
  return {
    description: hasVisibleText(course.content),
    level: Boolean(course.level),
    objectives: course.objectives.some((objective) => objective.trim().length > 0),
    totalTime: summary.totalSeconds !== null && summary.totalSeconds > 0,
    // A CME code with no credits tells a learner nothing — credits are the
    // number they are here for, so they, not the code, decide the block.
    cme: Boolean(course.cmeCredits && course.cmeCredits.trim().length > 0),
  };
}

/**
 * The course's total runtime, for the hero. Null when no item in the course
 * has a known duration — 43 of the library's videos are private and Vimeo
 * will not describe them, and "0m" would be a lie about a course with hours
 * in it.
 */
export function formatTotalTime(seconds: number | null): string | null {
  return formatDurationShort(seconds);
}

/**
 * The verb on the landing page's one action. Start / Resume / Review is
 * already decided for the course cards, and a learner meeting the same three
 * states should not meet a fourth set of words on the way in.
 */
export function ctaLabelKey(status: CourseProgressStatus): string {
  return courseActionLabelKey(status);
}
