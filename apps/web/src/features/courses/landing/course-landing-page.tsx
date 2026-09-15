import { isApiError, useCourseOutline, useLearnerCourseDetails } from '@sector/api-client';
import { Badge, Button, EmptyState, RichText, Skeleton } from '@sector/ui';
import { ChevronLeft, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { COURSES_PATH, coursePathFor, courseItemPathFor } from '../courses-links';
import { groupOutlineItemsForDisplay, resolveResumeTarget } from '../outline/course-outline-model';
import {
  formatDurationShort,
  groupTotalSeconds,
  summariseOutline,
} from '../outline/outline-summary';
import { ctaLabelKey, formatTotalTime, landingBlocks } from './course-landing-model';

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

  const { course, progress } = detailsQuery.data;
  const outline = outlineQuery.data;
  const summary = summariseOutline(outline.items);
  const blocks = landingBlocks(course, summary);
  const groups = groupOutlineItemsForDisplay(outline.items);
  const resumeItem = resolveResumeTarget(outline.items, outline.resume?.itemId ?? null);
  const totalTime = formatTotalTime(summary.totalSeconds);
  const certificatesUnavailable = import.meta.env.VITE_CERTIFICATES_UNAVAILABLE === 'true';

  return (
    <section aria-label={t('courses.landing.title')} className="flex flex-col gap-6">
      <div>
        <BackLink />
        <div className="flex flex-col gap-3">
          {course.imageUrl ? (
            <img
              src={course.imageUrl}
              alt=""
              className="max-h-64 w-full rounded-token object-cover"
            />
          ) : null}
          <h1 className="text-[22px] font-semibold text-ink">{course.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-body text-ink-dim">
            {blocks.level && course.level ? (
              <Badge tone="neutral">{t(`courses.landing.level.${course.level}`)}</Badge>
            ) : null}
            {blocks.totalTime && totalTime ? (
              <span>{t('courses.landing.totalTime', { duration: totalTime })}</span>
            ) : null}
            <span>{t('courses.landing.itemCount', { count: summary.totalItems })}</span>
            <span>{t('courses.landing.moduleCount', { count: groups.length })}</span>
          </div>
          {resumeItem ? (
            <div>
              <Button asChild>
                <Link
                  to={courseItemPathFor(courseId, resumeItem.id)}
                  state={{ title: course.title }}
                >
                  {t(ctaLabelKey(progress.status))}
                </Link>
              </Button>
            </div>
          ) : (
            <div>
              <Button variant="secondary" asChild>
                <Link to={coursePathFor(courseId)} state={{ title: course.title }}>
                  {t('courses.landing.viewOutline')}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {blocks.description && course.content ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-[16px] font-semibold text-ink">{t('courses.landing.about.title')}</h2>
          <RichText html={course.content} />
        </div>
      ) : null}

      {blocks.objectives ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-[16px] font-semibold text-ink">
            {t('courses.landing.objectives.title')}
          </h2>
          <ul className="list-disc pl-5 text-body text-ink-dim">
            {course.objectives
              .filter((objective) => objective.trim().length > 0)
              .map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h2 className="text-[16px] font-semibold text-ink">
          {t('courses.landing.contents.title')}
        </h2>
        {groups.length === 0 ? (
          <EmptyState title={t('courses.outline.empty.title')} />
        ) : (
          <ol className="flex flex-col gap-2">
            {groups.map((group) => {
              const minutes = formatDurationShort(groupTotalSeconds(group));
              const topics = group.children.filter((child) => child.kind === 'topic').length;
              const quizzes = group.children.filter((child) => child.kind === 'quiz').length;

              return (
                <li
                  key={group.header.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-token border border-line px-3 py-2"
                >
                  <span className="text-body font-medium text-ink">{group.header.title}</span>
                  <span className="text-[12px] text-ink-dim">
                    {t('courses.landing.moduleMeta', { topics, quizzes })}
                    {minutes ? ` · ${minutes}` : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {blocks.cme ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-[16px] font-semibold text-ink">{t('courses.landing.cme.title')}</h2>
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
    </section>
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
