import {
  isApiError,
  useExportGroupCourseDataMutation,
  useExportGroupCourseProgressMutation,
  useExportGroupScansMutation,
  useExportGroupUserScansMutation,
  useGroupScanReportDownload,
} from '@sector/api-client';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@sector/ui';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';

import { GroupDetailTabs, type GroupDetailLocationState } from '../group-detail-tabs';
import { downloadExportFile, downloadTextFile } from './download-export-file';

/**
 * The four server-generated exports plus the completion report, all
 * server-side (see `schemas/group-export.ts`) — nothing here rebuilds a
 * workbook in the browser, unlike the 1,189-line table the dashboard shipped
 * for this.
 */
export function GroupExportsPanel() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  const groupName = (location.state as GroupDetailLocationState)?.groupName;
  const title = groupName ?? t('groups.members.title');

  const exportScans = useExportGroupScansMutation(groupId ?? '');
  const exportUserScans = useExportGroupUserScansMutation(groupId ?? '');
  const exportCourseProgress = useExportGroupCourseProgressMutation();
  const exportCourseData = useExportGroupCourseDataMutation(groupId ?? '');
  const scanReport = useGroupScanReportDownload(groupId ?? '');

  const [courseIdInput, setCourseIdInput] = useState('');
  const [reportBusy, setReportBusy] = useState<'json' | 'csv' | null>(null);
  const [reportError, setReportError] = useState<string | undefined>();

  if (!groupId) return null;

  async function runExport(
    mutate: () => Promise<{ filename: string; buffer: string; contentType: string }>,
  ) {
    try {
      const result = await mutate();
      downloadExportFile(result);
    } catch {
      // Surfaced via each mutation's own isError below.
    }
  }

  async function downloadReport(format: 'json' | 'csv') {
    setReportBusy(format);
    setReportError(undefined);
    try {
      if (format === 'csv') {
        const csv = await scanReport.downloadCsv();
        downloadTextFile(csv, `group-${groupId}-report.csv`, 'text/csv');
      } else {
        const rows = await scanReport.downloadJson();
        downloadTextFile(
          JSON.stringify(rows, null, 2),
          `group-${groupId}-report.json`,
          'application/json',
        );
      }
    } catch (error) {
      setReportError(isApiError(error) ? error.message : t('groups.exports.error'));
    } finally {
      setReportBusy(null);
    }
  }

  return (
    <section aria-label={title}>
      <GroupDetailTabs groupId={groupId} title={title} active="exports" />

      <div className="flex flex-col gap-4">
        <ExportCard
          title={t('groups.exports.scans.title')}
          description={t('groups.exports.scans.description')}
          busy={exportScans.isPending}
          error={isApiError(exportScans.error) ? exportScans.error.message : undefined}
          onDownload={() => void runExport(() => exportScans.mutateAsync({}))}
        />

        <ExportCard
          title={t('groups.exports.userScans.title')}
          description={t('groups.exports.userScans.description')}
          busy={exportUserScans.isPending}
          error={isApiError(exportUserScans.error) ? exportUserScans.error.message : undefined}
          onDownload={() => void runExport(() => exportUserScans.mutateAsync({}))}
        />

        <ExportCard
          title={t('groups.exports.courseProgress.title')}
          description={t('groups.exports.courseProgress.description')}
          busy={exportCourseProgress.isPending}
          error={
            isApiError(exportCourseProgress.error) ? exportCourseProgress.error.message : undefined
          }
          onDownload={() => void runExport(() => exportCourseProgress.mutateAsync([groupId]))}
        />

        <Card>
          <CardHeader>
            <CardTitle>{t('groups.exports.courseData.title')}</CardTitle>
            <CardDescription>{t('groups.exports.courseData.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <Input
              value={courseIdInput}
              onChange={(event) => setCourseIdInput(event.target.value)}
              placeholder={t('groups.exports.courseData.coursePlaceholder')}
              className="w-72"
            />
            <Button
              size="sm"
              disabled={exportCourseData.isPending || !courseIdInput.trim()}
              onClick={() =>
                void runExport(() => exportCourseData.mutateAsync(courseIdInput.trim()))
              }
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {exportCourseData.isPending ? t('actions.downloading') : t('actions.download')}
            </Button>
          </CardContent>
          {exportCourseData.isError ? (
            <CardContent className="pt-0 text-[12px] text-crit">
              {isApiError(exportCourseData.error)
                ? exportCourseData.error.message
                : t('groups.exports.error')}
            </CardContent>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('groups.exports.report.title')}</CardTitle>
            <CardDescription>{t('groups.exports.report.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={reportBusy !== null}
              onClick={() => void downloadReport('csv')}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {reportBusy === 'csv' ? t('actions.downloading') : t('groups.exports.report.csv')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={reportBusy !== null}
              onClick={() => void downloadReport('json')}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {reportBusy === 'json' ? t('actions.downloading') : t('groups.exports.report.json')}
            </Button>
          </CardContent>
          {reportError ? (
            <CardContent className="pt-0 text-[12px] text-crit">{reportError}</CardContent>
          ) : null}
        </Card>
      </div>
    </section>
  );
}

function ExportCard({
  title,
  description,
  busy,
  error,
  onDownload,
}: {
  title: string;
  description: string;
  busy: boolean;
  error?: string;
  onDownload: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="sm" disabled={busy} onClick={onDownload}>
          <Download className="h-3.5 w-3.5" aria-hidden />
          {busy ? t('actions.downloading') : t('actions.download')}
        </Button>
        {error ? <p className="mt-2 text-[12px] text-crit">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
