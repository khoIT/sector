import type { Organization } from '@sector/api-client';

/**
 * ONE gate, in ONE direction, for the scan identifier.
 *
 * The legacy dashboard gated the INPUT and its READ-BACK on the same condition
 * in opposite directions:
 *
 *   create-scan/components/form-interpret.tsx:783
 *     shows the input      when  orgFormsEnabled && !isAmpathOrganization
 *   scans/components/scan-identifier-field.tsx:26
 *     returns null (hides) when  orgFormsEnabled && !isAmpathOrganization
 *
 * So exactly the organizations that were asked for a scan identifier were the
 * ones never shown it again, and the organization that reads it back was never
 * offered the field. Whatever was intended, one of the two is wrong.
 *
 * This resolves it toward the read-back: collect the identifier only where it
 * is displayed. Collecting a patient-adjacent identifier that no surface can
 * ever show is the worse failure of the two — it is data nobody asked to store
 * and nobody can check.
 *
 * The organization name is the only signal the API exposes; there is no
 * settings flag for this. Encoded here once so a future flag replaces one
 * function rather than two contradictory JSX conditions.
 */
export function organizationCollectsScanIdentifier(
  organization: Organization | undefined | null,
): boolean {
  if (!organization) return false;
  return organization.name.toLowerCase().includes('ampath');
}

/** True when ANY of the user's organizations collects the identifier. */
export function anyOrganizationCollectsScanIdentifier(
  organizations: Organization[] | undefined,
): boolean {
  return (organizations ?? []).some(organizationCollectsScanIdentifier);
}
