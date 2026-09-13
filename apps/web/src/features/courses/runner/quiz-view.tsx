import {
  courseKeys,
  courseQuizProgressKeys,
  retakeCourseQuiz,
  useApiClient,
  useCourseQuizDetail,
  type CourseOutlineItem,
  type CourseQuizDetail,
} from '@sector/api-client';
import { Badge, Button, EmptyState, RichText, Skeleton } from '@sector/ui';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Lock } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { QuizResults } from '@/features/question-banks/components/quiz-results';
import { QuizRunner } from '@/features/question-banks/components/quiz-runner';
import { useQuizRunner } from '@/features/question-banks/use-quiz-runner';
import { createCourseQuizAdapter } from '@/features/quiz/engine/adapters/course';
import { canStartQuiz } from '@/features/quiz/engine/refuse-empty-quiz';

import { coursePathFor } from '../courses-links';
import { blockedReasonLabelKey } from '../outline/course-outline-model';
import { CourseItemNav } from './course-item-nav';
import { toCourseQuizQuestions } from './to-course-quiz-questions';
import { useTrackCourseItemView } from './use-track-course-item-view';

export type QuizViewProps = {
  courseId: string;
  item: CourseOutlineItem;
};

/**
 * The course-quiz adapter mounted on the Phase 5 engine: `useQuizRunner`,
 * `QuizRunner` and `QuizResults` are the exact same hook and components the
 * question-bank surface uses, imported rather than duplicated — only
 * `createCourseQuizAdapter` (`quiz/engine/adapters/course.ts`) and this page
 * are new. `useQuizRunner` currently lives under `features/question-banks/`
 * because it was that surface's only caller when Phase 5 wrote it; its own
 * doc comment already describes the split generically ("a React hook wires
 * this to a real adapter and a running UI"), so importing it from here is
 * exercising that design, not working around it.
 */
export function QuizView({ courseId, item }: QuizViewProps) {
  const { t } = useTranslation();
  const detail = useCourseQuizDetail(courseId, item.id, !item.blockedReason);

  if (item.blockedReason) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          tone="crit"
          icon={<Lock className="h-5 w-5" aria-hidden />}
          title={t('courses.runner.quiz.blocked.title')}
          description={t(blockedReasonLabelKey(item.blockedReason))}
        />
        <CourseItemNav courseId={courseId} prevId={item.prevId} nextId={item.nextId} />
      </div>
    );
  }

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-9 w-32" />
      </div>
    );
  }

  if (detail.isError) {
    return (
      <EmptyState
        tone="crit"
        icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
        title={t('courses.runner.quiz.error.title')}
        description={detail.error instanceof Error ? detail.error.message : undefined}
        action={
          <Button variant="secondary" size="sm" onClick={() => void detail.refetch()}>
            {t('courses.runner.quiz.error.retry')}
          </Button>
        }
      />
    );
  }

  return <QuizRunnerSection key={item.id} courseId={courseId} item={item} quiz={detail.data} />;
}

function QuizRunnerSection({
  courseId,
  item,
  quiz,
}: {
  courseId: string;
  item: CourseOutlineItem;
  quiz: CourseQuizDetail;
}) {
  const { t } = useTranslation();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const questions = useMemo(() => toCourseQuizQuestions(quiz.questions), [quiz.questions]);
  const adapter = useMemo(
    () => createCourseQuizAdapter(client, courseId, item.id),
    [client, courseId, item.id],
  );
  const runner = useQuizRunner(questions, adapter);

  // Registers the "viewed" activity `POST .../quizzes/:quizId/track` requires
  // before it will accept a single answer — see `learners.controller.ts`'s
  // "Please view the quiz first before submitting."
  useTrackCourseItemView(courseId, 'quiz', item.id);

  const startable = canStartQuiz(questions.length);

  async function refreshQuizProgress() {
    await queryClient.invalidateQueries({ queryKey: courseQuizProgressKeys.root(courseId) });
    await queryClient.invalidateQueries({ queryKey: courseKeys.outline(courseId) });
  }

  async function handleFinish() {
    await runner.finish();
    await refreshQuizProgress();
  }

  async function retake() {
    await retakeCourseQuiz(client, courseId, item.id);
    runner.restart();
    await refreshQuizProgress();
  }

  async function backToOutline() {
    await refreshQuizProgress();
    navigate(coursePathFor(courseId));
  }

  if (runner.state.phase === 'running' || runner.state.phase === 'finishing') {
    return (
      <div className="flex flex-col gap-4">
        {runner.saveError ? (
          <Badge tone="warn" className="w-fit">
            {t('courses.runner.quiz.saveError')}
          </Badge>
        ) : null}
        <QuizRunner
          state={runner.state}
          elapsedSeconds={runner.elapsedSeconds}
          onSelectSingle={runner.selectSingle}
          onToggleMultiple={runner.toggleMultiple}
          onNext={runner.next}
          onPrevious={runner.previous}
          onGoTo={runner.goTo}
          onFinish={handleFinish}
        />
      </div>
    );
  }

  if (runner.state.phase === 'finished' && runner.state.result) {
    return (
      <div className="flex flex-col gap-4">
        <QuizResults
          result={runner.state.result}
          questions={questions}
          onTakeAgain={() => void retake()}
          onBackToList={() => void backToOutline()}
          backToListLabel={t('courses.runner.quiz.backToOutline')}
        />
        <CourseItemNav courseId={courseId} prevId={item.prevId} nextId={item.nextId} />
      </div>
    );
  }

  if (runner.state.phase === 'failed' && runner.state.failureKind === 'submit-error') {
    return (
      <EmptyState
        tone="crit"
        icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
        title={t('quiz.submitError')}
        description={runner.state.error ?? undefined}
        action={<Button onClick={() => void runner.finish()}>{t('quiz.retry')}</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[16px] font-semibold text-ink">{quiz.title}</h2>
      {quiz.content ? <RichText html={quiz.content} /> : null}

      {!startable ? (
        <EmptyState
          tone="crit"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
          title={t('courses.runner.quiz.noQuestions.title')}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="sv-num text-body text-ink-dim">
            {t('courses.runner.quiz.questionCount', { count: questions.length })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {isRetakeableQuizStatus(item.status) ? (
              <Button disabled={runner.isResuming} onClick={() => void retake()}>
                {t('courses.runner.quiz.retake')}
              </Button>
            ) : (
              <Button disabled={runner.isResuming} onClick={() => void runner.start()}>
                {item.status === 'in_progress'
                  ? t('courses.runner.quiz.continue')
                  : t('courses.runner.quiz.start')}
              </Button>
            )}
          </div>
          {runner.resumeError ? (
            <Badge tone="crit" className="w-fit">
              {t('courses.runner.quiz.resumeError')}
            </Badge>
          ) : null}
        </div>
      )}

      <CourseItemNav courseId={courseId} prevId={item.prevId} nextId={item.nextId} />
    </div>
  );
}

/**
 * `CourseOutlineItem['status']` is 3-valued on this branch: `fix/sector-course-shapes`
 * is adding the API's real 4th value (`failed`, for a quiz item scored below
 * the pass mark — B1 in `code-reviewer-260914-0102-sector-course-read-seam-adversarial-review-report.md`)
 * to `schemas/course-outline.ts`. Comparing against `string` rather than the
 * current narrow union means a failed quiz already offers "Retake" today,
 * and this keeps compiling unchanged once that merge lands the literal type.
 */
function isRetakeableQuizStatus(status: string): boolean {
  return status === 'completed' || status === 'failed';
}
