import { isApiError, useLearnerCourseDetails } from '@sector/api-client';
import { Badge, Button, EmptyState, RichText, Skeleton, cn } from '@sector/ui';
import { ChevronDown, ChevronRight, CircleCheck, TriangleAlert } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { COURSES_PATH, courseItemPathFor } from '../courses-links';
import {
  blockedReasonLabelKey,
  groupOutlineItemsForDisplay,
  isOutlineComplete,
  resolveResumeTarget,
  type CourseOutlineGroup,
} from '../outline/course-outline-model';
import { OutlineStatusGlyph } from '../outline/outline-status-glyph';
import {
  formatDurationShort,
  groupTotalSeconds,
  summariseOutline,
} from '../outline/outline-summary';
import { useCourseShell } from '../shell/course-shell-context';
import {
  completionPercent,
  ctaLabelKey,
  formatTotalTime,
  landingBlocks,
  outlineKindCounts,
} from './course-landing-model';
import { initialOpenModuleIds, toggleModuleId } from './module-row-state';

/**
 * The course's entry page: what it is, how long it takes, what the learner
 * gets — and, under that, the whole outline with each module expanding in
 * place.
 *
 * It used to be two pages. `/:courseId` was a bare item list and the
 * description lived behind `/:courseId/about`, on the premise that almost no
 * course had one. That premise came from `gusi_dev`: on production 96 of 102
 * live published courses carry a description. So the page a learner opens
 * leads with the description, and the outline is under it rather than
 * somewhere else.
 *
 * Every block is still conditional. A course with no description, no level
 * and no objectives has to read as short rather than broken, so a block with
 * no data renders nothing at all.
 *
 * The outline arrives from `useCourseShell()`, not from a query of this
 * page's own: this mounts as the shell's index child, and the shell has
 * already fetched it.
 */
export function CourseLandingPage() {
  const { t } = useTranslation();
  const { courseId, outline } = useCourseShell();

  const detailsQuery = useLearnerCourseDetails({ courseId });

  const groups = useMemo(() => groupOutlineItemsForDisplay(outline.items), [outline.items]);
  const resumeItem = resolveResumeTarget(outline.items, outline.resume?.itemId ?? null);
  // Seeded once, then owned by the learner: re-seeding on every render would
  // reopen the resume module each time the details query settles.
  const [openModuleIds, setOpenModuleIds] = useState<readonly string[]>(() =>
    initialOpenModuleIds(groups, resumeItem?.id ?? null),
  );

  if (detailsQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (detailsQuery.isError) {
    // Same rule as the shell: a 404 is the enrolment answering, not a blip,
    // so it offers My Courses rather than a retry that can never succeed.
    const error = detailsQuery.error;
    const isExpiredOrMissing = isApiError(error) && error.isNotFound;

    return (
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
    );
  }

  const { course, progress, assignmentType } = detailsQuery.data;
  const summary = summariseOutline(outline.items);
  const blocks = landingBlocks(course, summary);
  const counts = outlineKindCounts(outline.items);
  const totalTime = formatTotalTime(summary.totalSeconds);
  // Nothing left to watch needs no line. `formatDurationShort(0)` is the
  // string "0s", which is truthy — so a finished course showed "0s left"
  // directly above "You have completed this course."
  const remaining = summary.remainingSeconds ? formatDurationShort(summary.remainingSeconds) : null;
  // Completion is something the outline REPORTS, not something the absence of
  // a resume target implies: a course with no published content has nothing to
  // resume and nothing completed either.
  const isComplete = isOutlineComplete(outline);
  // The server's own number, not a recount: My Courses, the contents pane and
  // this card must all say the same percentage, and only one of them can own it.
  const percent = Number.isFinite(progress.progress)
    ? Math.round(progress.progress)
    : completionPercent(summary.completedItems, summary.totalItems);
  const certificatesUnavailable = import.meta.env.VITE_CERTIFICATES_UNAVAILABLE === 'true';

  return (
    <section aria-label={t('courses.landing.title')} className="flex flex-col gap-4">
      {/* Two columns on a wide screen: what the course is on the left, the one
          action and where the learner stands on the right. They stack on a
          phone, and the action column comes FIRST there — a learner who is
          already enrolled wants Continue, not the syllabus. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
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
                    <ModuleRow
                      courseId={courseId}
                      courseTitle={course.title}
                      group={group}
                      open={openModuleIds.includes(group.header.id)}
                      onToggle={() =>
                        setOpenModuleIds((open) => toggleModuleId(open, group.header.id))
                      }
                      t={t}
                    />
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
                {course.cmeCode ? ` · ${course.cmeCode}` : ''}
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
          ) : isComplete ? (
            <div className="flex items-center gap-2 rounded-token border border-line bg-ok-soft px-3 py-2 text-body text-ok">
              <CircleCheck className="h-4 w-4 shrink-0" aria-hidden />
              {t('courses.outline.completedBanner')}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

/**
 * One module: its state, its shape, how far in the learner is — and its
 * contents, in place.
 *
 * Expanding is not navigating. The old row was a link into the module's first
 * openable item, which meant the only way to see what a module held was to
 * start it. Now the row opens, and the child rows are the links.
 *
 * A module with no children stays a link, because a disclosure that opens
 * onto nothing is worse than the chevron it replaces: on a flat course —
 * which plenty of the imported ones are — every row is one of these.
 */
function ModuleRow({
  courseId,
  courseTitle,
  group,
  open,
  onToggle,
  t,
}: {
  courseId: string;
  courseTitle: string;
  group: CourseOutlineGroup;
  open: boolean;
  onToggle: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const panelId = useId();
  const minutes = formatDurationShort(groupTotalSeconds(group));
  const openable = group.children.filter((child) => !child.blockedReason);
  const topics = openable.filter((child) => child.kind === 'topic').length;
  const quizzes = openable.filter((child) => child.kind === 'quiz').length;
  const done = openable.filter((child) => child.status === 'completed').length;

  const summaryLine = (
    <span className="flex min-w-0 flex-1 flex-col text-left">
      <span className="truncate text-body font-medium text-ink">{group.header.title}</span>
      <span className="sv-num text-[12px] text-ink-dim">
        {t('courses.landing.moduleMeta', { topics, quizzes })}
        {minutes ? ` · ${minutes}` : ''}
      </span>
    </span>
  );
  const tally =
    openable.length > 0 ? (
      <span className="sv-num shrink-0 text-[12px] text-ink-dim">
        {done}/{openable.length}
      </span>
    ) : null;

  if (group.children.length === 0) {
    return (
      <Link
        to={courseItemPathFor(courseId, group.header.id)}
        state={{ title: courseTitle }}
        className="flex items-center gap-3 px-3.5 py-3 outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink"
      >
        <OutlineStatusGlyph
          status={group.header.status}
          blocked={Boolean(group.header.blockedReason)}
        />
        {summaryLine}
        {tally}
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-dim" aria-hidden />
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-3.5 py-3 outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink"
      >
        <OutlineStatusGlyph
          status={group.header.status}
          blocked={Boolean(group.header.blockedReason)}
        />
        {summaryLine}
        {tally}
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-ink-dim transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <ol id={panelId} className="flex flex-col border-t border-line bg-surface-2/40">
          {group.children.map((child) => (
            <li key={child.id}>
              <ChildRow courseId={courseId} courseTitle={courseTitle} item={child} />
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

/**
 * One topic or quiz inside an open module — the same three pieces the
 * player's contents pane shows (mark, title, duration), so a learner meets
 * one vocabulary in both places.
 */
function ChildRow({
  courseId,
  courseTitle,
  item,
}: {
  courseId: string;
  courseTitle: string;
  item: CourseOutlineGroup['children'][number];
}) {
  const { t } = useTranslation();
  const duration = formatDurationShort(item.durationSeconds);

  // A quiz with no questions explains itself rather than pretending to open.
  if (item.blockedReason) {
    return (
      <div className="flex items-start gap-3 py-2 pl-10 pr-3.5 text-body" aria-disabled="true">
        <OutlineStatusGlyph status={item.status} blocked className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ink-dim">{item.title}</span>
          <span className="text-[11px] text-crit">
            {t(blockedReasonLabelKey(item.blockedReason))}
          </span>
        </span>
      </div>
    );
  }

  return (
    <Link
      to={courseItemPathFor(courseId, item.id)}
      state={{ title: courseTitle }}
      className="flex items-center gap-3 py-2 pl-10 pr-3.5 text-body outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink"
    >
      <OutlineStatusGlyph status={item.status} />
      <span className="min-w-0 flex-1 truncate text-ink">{item.title}</span>
      {item.kind === 'quiz' && item.quiz ? (
        <span className="sv-num shrink-0 rounded-full border border-line px-1.5 text-[10px] text-ink-dim">
          {t('courses.runner.questionCount', { count: item.quiz.questionCount })}
        </span>
      ) : duration ? (
        <span className="sv-num shrink-0 text-[12px] text-ink-dim">{duration}</span>
      ) : null}
    </Link>
  );
}
