import { isApiError, useLearnerCourseAdminDetail } from '@sector/api-client';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  StatusPill,
} from '@sector/ui';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { ForbiddenPage } from '@/auth/forbidden-page';
import { useAuth } from '@/auth/auth-context';

import { roundedProgress } from '../my-courses/course-row-model';

const REQUIRED_PERMISSIONS = ['full-access', 'group:leader-access'] as const;

/**
 * `/learn/course-progress/:learnerId/:courseId` — a read-only summary of one
 * learner's course, for an admin or the group leader who assigned it. No
 * item-by-item breakdown: `GET /dashboard/learner-course-detail` (the only
 * route this client is allowed to call for ANOTHER learner's progress —
 * `GET /v2/learners/courses/:courseId/outline` only ever reads the CALLER's
 * own) returns the aggregate `UserCourseProgress` counters and the
 * enrolment/expiry facts, not a resolved per-item outline. Building that
 * would need a new API route; out of this phase's scope, see the phase
 * report.
 */
export function CourseReadOnlyAdminPage() {
  const { t } = useTranslation();
  const { canAny } = useAuth();
  const { learnerId = '', courseId = '' } = useParams<{ learnerId: string; courseId: string }>();
  const allowed = canAny([...REQUIRED_PERMISSIONS]);

  // Called unconditionally (react hooks rule) but `enabled: allowed` skips
  // the request entirely when the client-side check already fails — the
  // server enforces this for real (`full-access`, or `group:leader-access`
  // scoped to a group the caller leads AND the learner belongs to); this
  // only makes the denial legible instead of a raw 403 in the network tab.
  const query = useLearnerCourseAdminDetail(learnerId, courseId, allowed);

  if (!allowed) {
    return <ForbiddenPage required={REQUIRED_PERMISSIONS} />;
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <EmptyState
        tone="crit"
        icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
        title={t('courses.admin.error.title')}
        description={isApiError(query.error) ? query.error.message : undefined}
        action={
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {t('courses.admin.error.retry')}
          </Button>
        }
      />
    );
  }

  const { learner, courseDetail } = query.data;
  const percent = roundedProgress(courseDetail.progress.progress);

  return (
    <section aria-label={t('courses.admin.title')} className="flex flex-col gap-4">
      <div>
        <h2 className="text-[17px] font-semibold text-ink">
          {t('courses.admin.heading', { learner: learner.name, course: courseDetail.course.title })}
        </h2>
        <p className="text-body text-ink-dim">
          {t(`courses.admin.assignmentType.${courseDetail.assignmentType}`, {
            group: courseDetail.group?.name ?? '',
          })}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>{t('courses.admin.progress.title')}</CardTitle>
          <StatusPill
            tone={courseDetail.progress.status === 'completed' ? 'ok' : 'accent'}
            label={t(`courses.index.status.${courseDetail.progress.status}`)}
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
            </div>
            <p className="sv-num text-body text-ink-dim">
              {t('courses.index.progressLabel', { percent })}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-body">
            <AdminStat
              label={t('courses.admin.stat.completedItems')}
              value={`${courseDetail.progress.completedItems} / ${courseDetail.progress.totalItems}`}
            />
            <AdminStat
              label={t('courses.admin.stat.lessons')}
              value={String(courseDetail.progress.completedLessons)}
            />
            <AdminStat
              label={t('courses.admin.stat.topics')}
              value={String(courseDetail.progress.completedTopics)}
            />
            <AdminStat
              label={t('courses.admin.stat.quizzes')}
              value={String(courseDetail.progress.completedQuizzes)}
            />
            <AdminStat
              label={t('courses.admin.stat.lastAccessedAt')}
              value={
                courseDetail.progress.lastAccessedAt
                  ? new Date(courseDetail.progress.lastAccessedAt).toLocaleString()
                  : t('courses.admin.stat.never')
              }
            />
            <AdminStat
              label={t('courses.admin.stat.enrolledAt')}
              value={
                courseDetail.userCourse
                  ? new Date(courseDetail.userCourse.enrolledAt).toLocaleDateString()
                  : t('courses.admin.stat.never')
              }
            />
          </dl>

          {courseDetail.userCourse?.isExpired || courseDetail.group?.isMembershipExpired ? (
            <Badge tone="warn" className="w-fit">
              {t('courses.admin.expiredBadge')}
            </Badge>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function AdminStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[12px] text-ink-dim">{label}</dt>
      <dd className="sv-num text-ink">{value}</dd>
    </div>
  );
}
