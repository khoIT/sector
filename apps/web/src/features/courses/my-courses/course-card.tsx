import type { LearnerCourseListItem } from '@sector/api-client';
import { Button, Card, CardContent, StatusPill } from '@sector/ui';
import { GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { courseCardModel } from './course-card-model';
import { CourseCounts, CourseMeta, CourseProgressBar } from './course-facts';

export type CourseCardProps = {
  item: LearnerCourseListItem;
};

/**
 * One enrolment, as a card: a course library is a grid of covers in every LMS
 * this replaces, and a thumbnail, a progress bar and one action line up in a
 * grid far better than in dense table columns built for six-figure scan
 * queues.
 *
 * The cover is the exception rather than the rule. 92 of the 102 production
 * courses have no image, and reserving a 16:9 box for one spent 230px of every
 * card on a grey placeholder — so a course without a cover gets a 6px strip
 * and a glyph beside its title, and the space goes to what the course actually
 * says about itself.
 */
export function CourseCard({ item }: CourseCardProps) {
  const { t } = useTranslation();
  const model = courseCardModel(item);

  return (
    <Card className="flex flex-col overflow-hidden">
      {model.hasCover && model.coverUrl ? (
        <img src={model.coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />
      ) : (
        <div className="h-1.5 w-full bg-accent-soft" aria-hidden />
      )}

      <CardContent className="flex flex-1 flex-col gap-2.5 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex min-w-0 items-start gap-1.5 text-body font-semibold text-ink">
            {model.hasCover ? null : (
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-ink-dim" aria-hidden />
            )}
            <span className="min-w-0">{model.title}</span>
          </h3>
          <StatusPill tone={model.tone} label={t(model.statusKey)} />
        </div>

        {model.excerpt ? (
          <p className="line-clamp-2 text-[12px] leading-snug text-ink-dim">{model.excerpt}</p>
        ) : null}

        <CourseCounts model={model} />

        <div className="mt-auto flex flex-col gap-2 pt-1">
          <CourseProgressBar model={model} />
          <CourseMeta model={model} />

          <Button asChild variant="secondary" size="sm">
            {/* `state.title` is carried forward into the course runner, whose
                breadcrumb has no other source for it. */}
            <Link to={model.href} state={{ title: model.title }}>
              {t(model.actionLabelKey, { title: model.title })}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
