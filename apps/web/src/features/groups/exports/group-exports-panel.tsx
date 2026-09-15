import {
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
import { useParams } from 'react-router-dom';

import { errorMessage } from '@/lib/error-message';

import { GroupDetailTabs } from '../group-detail-tabs';
import { GroupProgressTable } from '../report/group-progress-table';
import { useGroupDetailTitle } from '../use-group-detail-title';
import { downloadExportFile, downloadTextFile } from './download-export-file';

/**
 * The four server-generated exports plus the completion report, all
 * server-side (see `schemas/group-export.ts`) — nothing here rebuilds a
 * workbook in the browser, unlike the 1,189-line table the dashboard shipped
 * for this.
 */
/** Which card a post-success download failure belongs to. */
type ExportCardId = 'scans' | 'userScans' | 'courseProgress' | 'courseData';

export function GroupExportsPanel() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const title = useGroupDetailTitle(groupId);

  const exportScans = useExportGroupScansMutation(groupId ?? '');
  const exportUserScans = useExportGroupUserScansMutation(groupId ?? '');
  const exportCourseProgress = useExportGroupCourseProgressMutation();
  const exportCourseData = useExportGroupCourseDataMutation(groupId ?? '');
  const scanReport = useGroupScanReportDownload(groupId ?? '');

  const [courseIdInput, setCourseIdInput] = useState('');
  const [reportBusy, setReportBusy] = useState<'json' | 'csv' | null>(null);
  const [reportError, setReportError] = useState<string | undefined>();
  /**
   * A failure that happened AFTER the request succeeded — decoding the base64
   * workbook, or handing the blob to the browser. Kept separate from each
   * mutation's own `isError`, because on this path the mutation SUCCEEDED:
   * reporting through it would have meant reporting through a flag that is
   * false, which is why a malformed payload used to produce no file, no
   * message and no trace of any kind.
   */
  const [downloadError, setDownloadError] = useState<{
    card: ExportCardId;
    message: string;
  } | null>(null);

  if (!groupId) return null;

  async function runExport(
    card: ExportCardId,
    mutate: () => Promise<{ filename: string; buffer: string; contentType: string }>,
  ) {
    setDownloadError(null);
    let result;
    try {
      result = await mutate();
    } catch {
      // The request itself failed; rendered from the mutation's own isError.
      return;
    }
    try {
      downloadExportFile(result);
    } catch (error) {
      setDownloadError({ card, message: errorMessage(error, t('groups.exports.decodeError')) });
    }
  }

  /** The post-success failure for one card, or undefined if it was another card's. */
  function decodeErrorFor(card: ExportCardId): string | undefined {
    return downloadError?.card === card ? downloadError.message : undefined;
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
      setReportError(errorMessage(error, t('groups.exports.error')));
    } finally {
      setReportBusy(null);
    }
  }

  return (
    <section aria-label={title}>
      <GroupDetailTabs groupId={groupId} active="exports" />

      <div className="flex flex-col gap-4">
        {/* The report reads on screen before it is downloaded: a leader
            chasing one learner should not have to open a spreadsheet. It
            calls the same route the download cards below call. */}
        <Card>
          <CardHeader>
            <CardTitle>{t('groups.report.title')}</CardTitle>
            <CardDescription>{t('groups.report.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <GroupProgressTable groupId={groupId ?? ''} />
          </CardContent>
        </Card>

        <ExportCard
          title={t('groups.exports.scans.title')}
          description={t('groups.exports.scans.description')}
          busy={exportScans.isPending}
          error={
            exportScans.isError
              ? errorMessage(exportScans.error, t('groups.exports.error'))
              : decodeErrorFor('scans')
          }
          onDownload={() => void runExport('scans', () => exportScans.mutateAsync({}))}
        />

        <ExportCard
          title={t('groups.exports.userScans.title')}
          description={t('groups.exports.userScans.description')}
          busy={exportUserScans.isPending}
          error={
            exportUserScans.isError
              ? errorMessage(exportUserScans.error, t('groups.exports.error'))
              : decodeErrorFor('userScans')
          }
          onDownload={() => void runExport('userScans', () => exportUserScans.mutateAsync({}))}
        />

        <ExportCard
          title={t('groups.exports.courseProgress.title')}
          description={t('groups.exports.courseProgress.description')}
          busy={exportCourseProgress.isPending}
          error={
            exportCourseProgress.isError
              ? errorMessage(exportCourseProgress.error, t('groups.exports.error'))
              : decodeErrorFor('courseProgress')
          }
          onDownload={() =>
            void runExport('courseProgress', () => exportCourseProgress.mutateAsync([groupId]))
          }
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
                void runExport('courseData', () =>
                  exportCourseData.mutateAsync(courseIdInput.trim()),
                )
              }
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {exportCourseData.isPending ? t('actions.downloading') : t('actions.download')}
            </Button>
          </CardContent>
          {exportCourseData.isError || decodeErrorFor('courseData') ? (
            <CardContent className="pt-0 text-[12px] text-crit">
              {exportCourseData.isError
                ? errorMessage(exportCourseData.error, t('groups.exports.error'))
                : decodeErrorFor('courseData')}
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
