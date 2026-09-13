import { Button } from '@sector/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { courseItemPathFor } from '../courses-links';

export type CourseItemNavProps = {
  courseId: string;
  prevId: string | null;
  nextId: string | null;
};

/**
 * Prev/next, straight off the outline item's own `prevId`/`nextId` — the
 * server's order, never re-derived here. This is the "breadcrumb and resume
 * agree, by construction" guarantee for in-content navigation: there is no
 * second traversal that could disagree with the sidebar's.
 */
export function CourseItemNav({ courseId, prevId, nextId }: CourseItemNavProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
      {prevId ? (
        <Button variant="secondary" asChild>
          <Link to={courseItemPathFor(courseId, prevId)}>
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            {t('courses.runner.nav.previous')}
          </Link>
        </Button>
      ) : (
        <span />
      )}
      {nextId ? (
        <Button asChild>
          <Link to={courseItemPathFor(courseId, nextId)}>
            {t('courses.runner.nav.next')}
            <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
