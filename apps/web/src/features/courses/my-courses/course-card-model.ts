import type { BadgeTone } from '@sector/ui';
import type { LearnerCourseListItem } from '@sector/api-client';

import { coursePathFor } from '../courses-links';
import { plainTextFromHtml } from '../html-text';
import { courseActionLabelKey, courseProgressTone, roundedProgress } from './course-row-model';

/**
 * One enrolment, reduced to what a card and a list row both draw.
 *
 * Two renderers of the same enrolment is two chances to state a different
 * number. Both read this, so "3 lessons" cannot become "4 lessons" by moving
 * a toggle.
 *
 * Every field is already on the wire — the list route sends `content`,
 * `imageUrl`, the version's three totals, `expiresAt` and
 * `progress.lastAccessedAt`. Nothing here costs a request.
 */
export type CourseCardModel = {
  title: string;
  href: string;
  percent: number;
  statusKey: string;
  actionLabelKey: string;
  tone: BadgeTone;
  /** Stripped and clamped. Null when the course has no description. */
  excerpt: string | null;
  counts: { lessons: number; topics: number; quizzes: number };
  /** True when every total is zero — an unpublished or pre-totals version. */
  countsUnknown: boolean;
  expiresAt: string | null;
  lastActiveAt: string | null;
  /** False for 92 of the 102 production courses, which carry no image. */
  hasCover: boolean;
  coverUrl: string | null;
};

/**
 * A description reduced to one or two lines of plain text.
 *
 * Clamped on a word boundary: cutting mid-word reads as a rendering fault
 * rather than as a deliberate summary. Returns null rather than an empty
 * string for a field a CMS left as `<p></p>` or `&nbsp;`, so the caller
 * renders nothing at all instead of an empty line with space reserved for it.
 */
export function excerptFromHtml(html: string | null | undefined, max = 140): string | null {
  const text = plainTextFromHtml(html);
  if (!text) return null;
  if (text.length <= max) return text;

  const boundary = text.lastIndexOf(' ', max);
  // A single word longer than the limit has no boundary to cut on; cut it
  // anyway rather than returning the whole thing.
  return `${text.slice(0, boundary > 0 ? boundary : max)}…`;
}

export function courseCardModel(item: LearnerCourseListItem): CourseCardModel {
  const totals = item.courseMetaVersion;
  const counts = {
    lessons: totals.totalLessons,
    topics: totals.totalTopics,
    quizzes: totals.totalQuiz,
  };

  return {
    title: item.course.title,
    href: coursePathFor(item.course.id),
    percent: roundedProgress(item.progress.progress),
    statusKey: `courses.index.status.${item.progress.status}`,
    actionLabelKey: courseActionLabelKey(item.progress.status),
    tone: courseProgressTone(item.progress.status),
    excerpt: excerptFromHtml(item.course.content),
    counts,
    // 43 of the mirror's version documents predate these totals and read as
    // zero. Three zeroes is "we do not know", not "this course is empty" —
    // an empty course would not have been published.
    countsUnknown: counts.lessons === 0 && counts.topics === 0 && counts.quizzes === 0,
    expiresAt: item.expiresAt,
    lastActiveAt: item.progress.lastAccessedAt,
    hasCover: Boolean(item.course.imageUrl),
    coverUrl: item.course.imageUrl,
  };
}
