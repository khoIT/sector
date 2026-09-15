import { Button, EmptyState } from '@sector/ui';
import { CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { courseAboutPathFor, courseItemPathFor } from '../courses-links';
import { useCourseShell } from '../shell/course-shell-context';
import { CourseOutlineItemRow } from './course-outline-item-row';
import {
  groupOutlineItemsForDisplay,
  isOutlineComplete,
  resolveResumeTarget,
  resumeActionLabelKey,
} from './course-outline-model';

/**
 * The course's index route: the full ordered outline, with the resume action
 * at the top.
 *
 * The back link, the progress header and the outline fetch all moved up into
 * `CourseShell`, which mounts this as a child — so opening an item from here
 * swaps this list for the item view and leaves the chrome standing.
 */
export function CourseOutlinePage() {
  const { t } = useTranslation();
  const { courseId, courseTitle, outline } = useCourseShell();

  const groups = groupOutlineItemsForDisplay(outline.items);
  const resumeItem = resolveResumeTarget(outline.items, outline.resume?.itemId ?? null);
  // Completion is something the outline REPORTS, not something the absence of
  // a resume pointer implies. A course with no published content has nothing
  // to resume and nothing completed either, and telling that learner they had
  // finished it was the plainest thing on the page that was untrue.
  const isComplete = isOutlineComplete(outline);

  return (
    <>
      {resumeItem ? (
        <Button asChild className="mb-4">
          <Link to={courseItemPathFor(courseId, resumeItem.id)} state={{ title: courseTitle }}>
            {t(resumeActionLabelKey(resumeItem.status), { title: resumeItem.title })}
          </Link>
        </Button>
      ) : isComplete ? (
        <div className="mb-4 flex items-center gap-2 rounded-token border border-line bg-ok-soft px-3 py-2 text-body text-ok">
          <CircleCheck className="h-4 w-4" aria-hidden />
          {t('courses.outline.completedBanner')}
        </div>
      ) : null}

      <Link
        to={courseAboutPathFor(courseId)}
        className="mb-3 inline-block text-body text-accent-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent-ink"
      >
        {t('courses.landing.title')}
      </Link>

      {groups.length === 0 ? (
        <EmptyState title={t('courses.outline.empty.title')} />
      ) : (
        <ol className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.header.id} className="flex flex-col gap-1.5">
              <CourseOutlineItemRow
                courseId={courseId}
                courseTitle={courseTitle}
                item={group.header}
                indent={false}
                isResumeTarget={group.header.id === resumeItem?.id}
              />
              {group.children.length > 0 ? (
                <ol className="flex flex-col gap-1.5">
                  {group.children.map((child) => (
                    <li key={child.id}>
                      <CourseOutlineItemRow
                        courseId={courseId}
                        courseTitle={courseTitle}
                        item={child}
                        indent
                        isResumeTarget={child.id === resumeItem?.id}
                      />
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
