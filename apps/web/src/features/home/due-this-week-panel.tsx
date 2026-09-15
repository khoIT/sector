import { useMyAssignmentsDue } from '@sector/api-client';
import { Card, CardContent, CardHeader, CardTitle, Skeleton, StatusPill } from '@sector/ui';
import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { CardError } from './card-error';
import { assignmentTitle, isOverdue, selectDueThisWeek } from './due-this-week-model';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * What a learner owes in the next week, late things first.
 *
 * Production's clearest number sits behind this: 2,440 of 4,595 dated
 * assignments are overdue and still open, and until the reminder job shipped
 * nothing told anyone. This is the in-product half of that — the reminder
 * email and this panel are built from the same server-side route and the same
 * server-built link, so they cannot name different destinations.
 *
 * A learner with nothing due sees NOTHING — no empty card, no "you're all
 * caught up". Same call the Continue row makes: a card that exists only to
 * say it has nothing to say is noise on a screen someone reads every day.
 * A failure is not nothing, though, and still renders as an error.
 */
export function DueThisWeekPanel() {
  const { t } = useTranslation();
  const now = new Date();
  const dueDateTo = new Date(now.getTime() + SEVEN_DAYS_MS).toISOString();

  // No `userId`: the server reads whose dashboard this is from the session.
  const assignments = useMyAssignmentsDue({ dueDateTo, limit: 10 });

  if (assignments.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('home.dueThisWeek.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (assignments.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('home.dueThisWeek.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardError error={assignments.error} onRetry={() => void assignments.refetch()} />
        </CardContent>
      </Card>
    );
  }

  const rows = selectDueThisWeek(assignments.data.assignments, now);

  // Nothing owed: render nothing at all, not an empty card.
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('home.dueThisWeek.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const late = isOverdue(row, now);
            const title = assignmentTitle(row) ?? t('home.dueThisWeek.untitled');

            return (
              <li key={row.id}>
                <Link
                  to={row.route}
                  className="flex items-start gap-2 rounded-token border border-line bg-surface px-2.5 py-2 text-body outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-ink"
                >
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-ink-dim" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-ink">{title}</span>
                    <span className="text-[12px] text-ink-dim">
                      {new Date(row.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                  <StatusPill
                    tone={late ? 'crit' : 'warn'}
                    label={late ? t('home.dueThisWeek.overdue') : t('home.dueThisWeek.upcoming')}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
