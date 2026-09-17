import { useUserOrganizations } from '@sector/api-client';
import { Card, CardContent, CardHeader, CardTitle, Input, Textarea } from '@sector/ui';
import { useMemo } from 'react';

import { useAuth } from '@/auth/auth-context';

import { anyOrganizationCollectsScanIdentifier } from '../model/identifier-gate';
import type { UseCreateScanDraft } from '../model/use-create-scan-draft';
import { useTranslation } from 'react-i18next';

export type ClinicalNotePanelProps = {
  draft: UseCreateScanDraft;
  /** Shorter on the working surface, where it sits in a column of its own. */
  rows?: number;
};

/**
 * The note, and the two identifiers that travel with it.
 *
 * Extracted from the interpretation step so the working surface can put it at
 * the end of its column without pulling the scan-type picker and the media
 * viewer along with it.
 */
export function ClinicalNotePanel({ draft, rows = 6 }: ClinicalNotePanelProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: organizations } = useUserOrganizations(user?.id);
  const { state, update } = draft;

  // ONE gate, used for collecting the identifier and (by the same helper) for
  // showing it back. See model/identifier-gate.ts for why the legacy pair
  // pointed in opposite directions.
  const collectsScanIdentifier = useMemo(
    () => anyOrganizationCollectsScanIdentifier(organizations),
    [organizations],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('createScan.clinicalNote.title')}</CardTitle>
        <p className="mt-0.5 text-[12px] text-ink-dim">{t('createScan.clinicalNote.blurb')}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          label={t('createScan.clinicalNote.noteLabel')}
          placeholder={t('createScan.clinicalNote.notePlaceholder')}
          value={state.note}
          rows={rows}
          onChange={(event) => update({ note: event.target.value })}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('createScan.clinicalNote.patientIdLabel')}
            hint={t('createScan.clinicalNote.patientIdHint')}
            maxLength={100}
            value={state.externalPatientId}
            onChange={(event) => update({ externalPatientId: event.target.value })}
          />

          {collectsScanIdentifier ? (
            <Input
              label={t('createScan.clinicalNote.scanIdLabel')}
              hint={t('createScan.clinicalNote.scanIdHint')}
              value={state.scanIdentifier}
              onChange={(event) => update({ scanIdentifier: event.target.value })}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
