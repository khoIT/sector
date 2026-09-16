import { isApiError, useCourseOutline, useLearnerCourseDetails } from '@sector/api-client';
import { Badge, Button, EmptyState, RichText, Skeleton } from '@sector/ui';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { COURSES_PATH, coursePathFor, courseItemPathFor } from '../courses-links';
import { groupOutlineItemsForDisplay, resolveResumeTarget } from '../outline/course-outline-model';
import { OutlineStatusGlyph } from '../outline/outline-status-glyph';
import {
  formatDurationShort,
  groupTotalSeconds,
  summariseOutline,
} from '../outline/outline-summary';
import {
  completionPercent,
  ctaLabelKey,
  formatTotalTime,
  landingBlocks,
  outlineKindCounts,
} from './course-landing-model';

/**
 * "What is this, how long will it take, and what do I get?" — the three
 * questions a learner asks before committing, which a bare item list and a
 * percentage never answered.
 *
 * Every block here is conditional. Most courses in the library carry no
 * description, no level and no objectives, so this page has to read well when
 * the only things it knows are the ones it can compute: the module list, the
 * item counts and the total runtime. A heading with an empty body under it is
 * what makes a sparse course look broken, so a block with no data renders
 * nothing at all.
 */
export function CourseLandingPage() {
  const { t } = useTranslation();
  const { courseId = '' } = useParams<{ courseId: string }>();

  const detailsQuery = useLearnerCourseDetails({ courseId });
  const outlineQuery = useCourseOutline({ courseId });

  if (detailsQuery.isPending || outlineQuery.isPending) {
    return (
      <section aria-label={t('courses.landing.title')} className="flex flex-col gap-4">
        <BackLink />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </section>
    );
  }

  if (detailsQuery.isError || outlineQuery.isError) {
    const error = detailsQuery.error ?? outlineQuery.error;
    // Same rule as the shell: a 404 is the enrolment answering, not a blip,
    // so it offers My Courses rather than a retry that can never succeed.
    const isExpiredOrMissing = isApiError(error) && error.isNotFound;

    return (
      <section aria-label={t('courses.landing.title')}>
        <BackLink />
        <EmptyState
          tone="crit"
          icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
          title={
            isExpiredOrMissing
              ? t('courses.runner.noLongerAvailable.title')
              : t('courses.landing.error.title')
          }
          description={
            isExpiredOrMissing
              ? t('courses.runner.noLongerAvailable.description')
              : isApiError(error)
                ? error.message
                : undefined
          }
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link to={COURSES_PATH}>{t('courses.index.title')}</Link>
            </Button>
          }
        />
      </section>
    );
  }

  const { course, progress, assignmentType } = detailsQuery.data;
  const outline = outlineQuery.data;
  const summary = summariseOutline(outline.items);
  const blocks = landingBlocks(course, summary);
  const groups = groupOutlineItemsForDisplay(outline.items);
  const counts = outlineKindCounts(outline.items);
  const resumeItem = resolveResumeTarget(outline.items, outline.resume?.itemId ?? null);
  const totalTime = formatTotalTime(summary.totalSeconds);
  const remaining = formatDurationShort(summary.remainingSeconds);
  // The server's own number, not a recount: My Courses, the outline header and
  // this card must all say the same percentage, and only one of them can own it.
  const percent = Number.isFinite(progress.progress)
    ? Math.round(progress.progress)
    : completionPercent(summary.completedItems, summary.totalItems);
  const certificatesUnavailable = import.meta.env.VITE_CERTIFICATES_UNAVAILABLE === 'true';

  return (
    <section aria-label={t('courses.landing.title')} className="flex flex-col gap-4">
      <BackLink />

      {/* Two columns on a wide screen: what the course is on the left, the one
          action and where the learner stands on the right. They stack on a
          phone, and the action column comes FIRST there — a learner who is
          already enrolled wants Continue, not the syllabus. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="order-2 flex flex-col gap-6 lg:order-1">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
              {t(`courses.landing.eyebrow.${assignmentType === 'group' ? 'group' : 'personal'}`)}
            </span>
            <h1 className="text-[26px] font-semibold leading-tight text-ink">{course.title}</h1>
            {blocks.description && course.content ? (
              <div className="max-w-[62ch] text-body text-ink-dim">
                <RichText html={course.content} />
              </div>
            ) : null}

            {/* The course in the learner's own units. `sv-num` keeps the
                figures on tabular digits so the row does not jitter. */}
            <div className="sv-num mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-body text-ink-dim">
              <span>
                <strong className="font-semibold text-ink">{counts.modules}</strong>{' '}
                {t('courses.landing.modulesWord', { count: counts.modules })}
              </span>
              <span>
                <strong className="font-semibold text-ink">{counts.topics}</strong>{' '}
                {t('courses.landing.topicsWord', { count: counts.topics })}
              </span>
              <span>
                <strong className="font-semibold text-ink">{counts.quizzes}</strong>{' '}
                {t('courses.landing.quizzesWord', { count: counts.quizzes })}
              </span>
              {blocks.totalTime && totalTime ? (
                <span>
                  <strong className="font-semibold text-ink">{totalTime}</strong>{' '}
                  {t('courses.landing.ofVideo')}
                </span>
              ) : null}
              {blocks.level && course.level ? (
                <Badge tone="neutral">
                  {t('courses.landing.levelLabel', {
                    level: t(`courses.landing.level.${course.level}`),
                  })}
                </Badge>
              ) : null}
              <Badge tone="neutral">
                {blocks.cme
                  ? t('courses.landing.cme.pill', { credits: course.cmeCredits })
                  : t('courses.landing.cme.none')}
              </Badge>
            </div>
          </div>

          {/* "What you'll learn" only appears once somebody has authored it.
              A heading over an empty card is what makes a sparse course look
              broken, which is the whole rule this page is built on. */}
          {blocks.objectives ? (
            <div className="flex flex-col gap-3 rounded-token border border-line bg-surface p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
                {t('courses.landing.objectives.title')}
              </span>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body text-ink">
                {course.objectives
                  .filter((objective) => objective.trim().length > 0)
                  .map((objective, index) => (
                    <li key={`${objective}-${index}`}>{objective}</li>
                  ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
              {t('courses.landing.modules.title')}
            </span>
            {groups.length === 0 ? (
              <EmptyState title={t('courses.outline.empty.title')} />
            ) : (
              <ol className="flex flex-col overflow-hidden rounded-token border border-line bg-surface">
                {groups.map((group, index) => (
                  <li key={group.header.id} className={index ? 'border-t border-line' : ''}>
                    <ModuleRow courseId={courseId} courseTitle={course.title} group={group} t={t} />
                  </li>
                ))}
              </ol>
            )}
          </div>

          {blocks.cme && (course.cmeUrl || certificatesUnavailable) ? (
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[16px] font-semibold text-ink">
                {t('courses.landing.cme.title')}
              </h2>
              <p className="text-body text-ink-dim">
                {t('courses.landing.cme.credits', { credits: course.cmeCredits })}
                {course.cmeCode ? ` \u00b7 ${course.cmeCode}` : ''}
              </p>
              {course.cmeUrl ? (
                <a
                  href={course.cmeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-body text-accent-ink hover:underline"
                >
                  {t('courses.landing.cme.link')}
                </a>
              ) : null}
              {certificatesUnavailable ? (
                <p className="text-[12px] text-ink-dim">{t('courses.landing.cme.unavailable')}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Sticky on a wide screen so Continue stays reachable however long
            the module list runs. */}
        <aside className="order-1 flex flex-col gap-3 rounded-token border border-line bg-surface p-4 lg:sticky lg:top-4 lg:order-2">
          {course.imageUrl ? (
            <img
              src={course.imageUrl}
              alt=""
              className="aspect-video w-full rounded-token object-cover"
            />
          ) : null}

          <div className="sv-num flex items-baseline justify-between gap-2">
            <span className="text-body font-semibold text-ink">
              {t('courses.landing.percentComplete', { percent })}
            </span>
            {remaining ? (
              <span className="text-[12px] text-ink-dim">
                {t('courses.landing.timeLeft', { duration: remaining })}
              </span>
            ) : null}
          </div>

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('courses.landing.percentComplete', { percent })}
          >
            <div className="h-full rounded-full bg-accent-ink" style={{ width: `${percent}%` }} />
          </div>

          <p className="sv-num text-[12px] text-ink-dim">
            {t('courses.landing.progressCounts', {
              modulesDone: counts.modulesDone,
              modules: counts.modules,
              topicsDone: counts.topicsDone,
              topics: counts.topics,
              quizzesDone: counts.quizzesDone,
              quizzes: counts.quizzes,
            })}
          </p>

          {resumeItem ? (
            <Button asChild className="w-full justify-center">
              <Link to={courseItemPathFor(courseId, resumeItem.id)} state={{ title: course.title }}>
                <span className="truncate">
                  {t(ctaLabelKey(progress.status))}
                  {': '}
                  {resumeItem.title}
                </span>
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" asChild className="w-full justify-center">
              <Link to={coursePathFor(courseId)} state={{ title: course.title }}>
                {t('courses.landing.viewOutline')}
              </Link>
            </Button>
          )}

          {/* Only beside a Continue button. On a finished course the button
              IS the outline link, and two of them read as a mistake. */}
          {resumeItem ? (
            <Link
              to={coursePathFor(courseId)}
              state={{ title: course.title }}
              className="text-center text-[12px] text-accent-ink hover:underline"
            >
              {t('courses.landing.viewOutline')}
            </Link>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

/**
 * One module: its state, its shape, and how far in the learner is.
 *
 * The row opens the module's first openable item rather than a module page,
 * which does not exist — a chevron that goes nowhere is worse than one that
 * goes to the obvious place.
 */
function ModuleRow({
  courseId,
  courseTitle,
  group,
  t,
}: {
  courseId: string;
  courseTitle: string;
  group: ReturnType<typeof groupOutlineItemsForDisplay>[number];
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const minutes = formatDurationShort(groupTotalSeconds(group));
  const children = group.children.filter((child) => !child.blockedReason);
  const topics = children.filter((child) => child.kind === 'topic').length;
  const quizzes = children.filter((child) => child.kind === 'quiz').length;
  const done = children.filter((child) => child.status === 'completed').length;
  const target =
    children.find((child) => child.status !== 'completed') ?? children[0] ?? group.header;

  return (
    <Link
      to={courseItemPathFor(courseId, target.id)}
      state={{ title: courseTitle }}
      className="flex items-center gap-3 px-3.5 py-3 outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-ink"
    >
      <OutlineStatusGlyph
        status={group.header.status}
        blocked={Boolean(group.header.blockedReason)}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-medium text-ink">{group.header.title}</span>
        <span className="sv-num text-[12px] text-ink-dim">
          {t('courses.landing.moduleMeta', { topics, quizzes })}
          {minutes ? ` \u00b7 ${minutes}` : ''}
        </span>
      </span>
      {children.length > 0 ? (
        <span className="sv-num shrink-0 text-[12px] text-ink-dim">
          {done}/{children.length}
        </span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-dim" aria-hidden />
    </Link>
  );
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      to={COURSES_PATH}
      className="mb-2 inline-flex items-center gap-1 text-body text-accent-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent-ink"
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      {t('courses.outline.backToCourses')}
    </Link>
  );
}
