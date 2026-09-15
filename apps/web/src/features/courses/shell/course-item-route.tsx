import { Button, EmptyState } from '@sector/ui';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { coursePathFor } from '../courses-links';
import { findOutlineItem } from '../outline/course-outline-model';
import { LessonView } from '../runner/lesson-view';
import { QuizView } from '../runner/quiz-view';
import { TopicView } from '../runner/topic-view';
import { useCourseShell } from './course-shell-context';

/**
 * `/learn/courses/:courseId/:itemId` — the ONE child route every nesting shape
 * the outline resolves opens through: a lesson, a topic, a course-level or
 * topic-nested quiz, all dispatched off `item.kind` rather than the four
 * separate route trees the legacy dashboard mounted.
 *
 * It fetches nothing. The shell above it holds the resolved outline, so
 * changing item re-renders this component and nothing else.
 */
export function CourseItemRoute() {
  const { t } = useTranslation();
  const { itemId = '' } = useParams<{ itemId: string }>();
  const { courseId, courseTitle, outline } = useCourseShell();

  const item = findOutlineItem(outline.items, itemId);

  if (!item) {
    return (
      <EmptyState
        title={t('courses.runner.itemNotFound.title')}
        description={t('courses.runner.itemNotFound.description')}
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link to={coursePathFor(courseId)}>{t('courses.outline.title')}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <article aria-label={item.title} className="flex flex-col gap-4">
      <h2 className="text-[17px] font-semibold text-ink">{item.title}</h2>
      {item.kind === 'lesson' ? (
        <LessonView
          courseId={courseId}
          courseTitle={courseTitle}
          item={item}
          items={outline.items}
        />
      ) : null}
      {item.kind === 'topic' ? <TopicView courseId={courseId} item={item} /> : null}
      {item.kind === 'quiz' ? <QuizView courseId={courseId} item={item} /> : null}
    </article>
  );
}
