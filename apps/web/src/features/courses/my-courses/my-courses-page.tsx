import {
  isApiError,
  LIST_SEARCH_DEBOUNCE_MS,
  useCourses,
  type CourseListStatusFilter,
} from '@sector/api-client';
import {
  Button,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@sector/ui';
import { GraduationCap, Search, TriangleAlert, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DataTablePagination } from '../../scan-list/table/data-table-pagination';
import { filterValue, hasActiveNarrowing, setFilter } from '../../scan-list/table/list-url-state';
import { useDebouncedValue } from '../../scan-list/table/use-debounced-value';
import { useListUrlState } from '../../scan-list/table/use-list-url-state';
import { CourseCard } from './course-card';
import { COURSE_LIST_STATUS_FILTERS } from './course-row-model';
import { ExpiredCoursesSection } from './expired-courses-section';

/** A sentinel for "no status narrowing", since Radix's Select cannot carry
 *  an empty-string item value. */
const ALL_STATUSES = 'all';

/** A URL filter value, narrowed to one this list actually offers. */
function asStatusFilter(value: string | string[] | undefined): CourseListStatusFilter | undefined {
  return typeof value === 'string' &&
    (COURSE_LIST_STATUS_FILTERS as readonly string[]).includes(value)
    ? (value as CourseListStatusFilter)
    : undefined;
}

/**
 * My Courses: the learner's own enrolments, filtered and paginated by the
 * SERVER's own `keyword`/`status` query params — not the legacy dashboard's
 * fetch-100-and-filter-in-the-browser, which is exactly what hid enrolment
 * 101+ from anyone with more than 100 courses. `expired` is a separate array
 * the API sends beside `items`; it is rendered as its own section, never
 * folded into the active grid.
 */
export function MyCoursesPage() {
  const { t } = useTranslation();

  const url = useListUrlState([]);
  const debouncedKeyword = useDebouncedValue(url.keyword, LIST_SEARCH_DEBOUNCE_MS);
  // The URL is user input. A value this menu does not offer — a hand-edited
  // link, a bookmark from before a filter was renamed — is dropped here
  // rather than forwarded, because the route answers an unknown one with a
  // 400 whose validator text then becomes the learner's error message.
  const status = asStatusFilter(filterValue(url.filters, 'status'));

  const query = useCourses({
    query: { keyword: debouncedKeyword, status, page: url.page, limit: url.limit },
  });

  const items = query.data?.items ?? [];
  const narrowed = hasActiveNarrowing({ keyword: url.keyword, filters: url.filters });
  const searched = url.keyword.trim().length > 0;
  const pagePastEnd = items.length === 0 && !query.isPending && (query.data?.totalItems ?? 0) > 0;

  function setStatus(value: string) {
    url.setFilters(setFilter(url.filters, 'status', value === ALL_STATUSES ? undefined : value));
  }

  if (query.isError) {
    return (
      <section aria-label={t('courses.index.title')}>
        <h2 className="mb-3 text-[17px] font-semibold text-ink">{t('courses.index.title')}</h2>
        <EmptyState
          tone="crit"
          icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
          title={t('courses.index.error.title')}
          description={isApiError(query.error) ? query.error.message : undefined}
          action={
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              {t('courses.index.error.retry')}
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section aria-label={t('courses.index.title')}>
      <h2 className="mb-3 text-[17px] font-semibold text-ink">{t('courses.index.title')}</h2>

      <div className="flex flex-wrap items-center gap-2 pb-4">
        <div className="relative min-w-[14rem] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-dim"
            aria-hidden
          />
          <Input
            value={url.keyword}
            onChange={(event) => url.setKeyword(event.target.value)}
            placeholder={t('courses.index.searchPlaceholder')}
            aria-label={t('courses.index.searchPlaceholder')}
            className="pl-8 pr-8"
          />
          {url.keyword ? (
            <button
              type="button"
              onClick={() => url.setKeyword('')}
              aria-label={t('toolbar.clearSearch')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-ink-dim outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        <Select value={status ?? ALL_STATUSES} onValueChange={setStatus}>
          <SelectTrigger className="w-[10rem]" aria-label={t('courses.index.statusFilter.label')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>{t('courses.index.statusFilter.all')}</SelectItem>
            {COURSE_LIST_STATUS_FILTERS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`courses.index.statusFilter.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="aspect-[4/5] w-full rounded-token" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-5 w-5" aria-hidden />}
          title={
            pagePastEnd
              ? t('courses.index.pagePastEnd.title')
              : narrowed
                ? t('courses.index.noMatch.title')
                : t('courses.index.empty.title')
          }
          description={
            pagePastEnd
              ? undefined
              : narrowed
                ? // Only a keyword search can name what it did not match.
                  // Narrowing by status alone used to render the same
                  // sentence with an empty pair of quotation marks in it.
                  searched
                  ? t('courses.index.noMatch.description', { keyword: url.keyword })
                  : t('courses.index.noMatch.descriptionFiltered')
                : t('courses.index.empty.description')
          }
          action={
            pagePastEnd ? (
              <Button variant="secondary" size="sm" onClick={() => url.setPage(1)}>
                {t('courses.index.pagePastEnd.backToFirstPage')}
              </Button>
            ) : narrowed ? (
              <Button variant="secondary" size="sm" onClick={url.clearNarrowing}>
                {t('toolbar.clearSearch')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <CourseCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {items.length > 0 || pagePastEnd ? (
        <DataTablePagination
          page={url.page}
          limit={url.limit}
          totalItems={query.data?.totalItems ?? 0}
          totalPages={query.data?.totalPages ?? 1}
          onPageChange={url.setPage}
          onLimitChange={url.setLimit}
          busy={query.isFetching}
        />
      ) : null}

      {/* The route sends the COMPLETE expired array with every page — it
          paginates `items` only — so rendering it under page 3 as well would
          repeat the same list rather than continue it. It belongs to the
          enrolment set, not to a page of it. */}
      {url.page === 1 ? <ExpiredCoursesSection items={query.data?.expired ?? []} /> : null}
    </section>
  );
}
