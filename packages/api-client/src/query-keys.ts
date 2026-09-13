/**
 * Query- and mutation-key factories.
 *
 * The legacy dashboard hand-wrote every key as a bare string literal with no
 * factory and no `as const`, so a typo produced a silent cache miss with no
 * type error. These factories emit the SAME kebab-case string prefixes so
 * hierarchical invalidation by prefix keeps working, but the strings now live
 * in exactly one place.
 *
 * Invalidate broadly with the *Root helpers:
 *   queryClient.invalidateQueries({ queryKey: scanKeys.listRoot('my') })
 */

/** The five scan list surfaces. Each has its own route pair and cache key. */
export type ScanListView = 'my' | 'pending' | 'reviewed' | 'expert' | 'expert-reviewed';

export const SCAN_LIST_VIEWS = [
  'my',
  'pending',
  'reviewed',
  'expert',
  'expert-reviewed',
] as const satisfies readonly ScanListView[];

const SCAN_LIST_KEY: Record<ScanListView, string> = {
  my: 'get-scans',
  pending: 'get-pending-scans',
  reviewed: 'get-reviewed-scans',
  expert: 'get-expert-scans',
  'expert-reviewed': 'get-expert-reviewed-scans',
};

const SCAN_DETAIL_KEY: Record<ScanListView, string> = {
  my: 'get-scan-by-id',
  pending: 'get-pending-scan-by-id',
  reviewed: 'get-reviewed-scan-by-id',
  expert: 'get-expert-scan-by-id',
  'expert-reviewed': 'get-expert-reviewed-scan-by-id',
};

export const scanKeys = {
  /** Prefix for every list of a view. Use to invalidate all its pages. */
  listRoot: (view: ScanListView) => [SCAN_LIST_KEY[view]] as const,
  list: (view: ScanListView, params: unknown) => [SCAN_LIST_KEY[view], params] as const,
  /** Prefix for every detail of a view. */
  detailRoot: (view: ScanListView) => [SCAN_DETAIL_KEY[view]] as const,
  detail: (view: ScanListView, scanId: string) => [SCAN_DETAIL_KEY[view], scanId] as const,
  /** Every list across all five views, for a change that can move a scan. */
  allListRoots: () => SCAN_LIST_VIEWS.map((view) => [SCAN_LIST_KEY[view]] as const),
  users: (type: 'pending' | 'reviewed') => ['get-scan-users', type] as const,
  userGroups: () => ['get-scan-user-groups'] as const,
} as const;

export const noteKeys = {
  listRoot: () => ['get-scan-notes'] as const,
  list: (scanId: string) => ['get-scan-notes', scanId] as const,
} as const;

export const reviewKeys = {
  credits: () => ['scan-review-credits'] as const,
  /** GET /api/scan-review/groups. The legacy /credits/groups path 404s. */
  groups: () => ['scan-review-groups'] as const,
} as const;

export const sharedScanKeys = {
  listRoot: () => ['get-shared-scans'] as const,
  list: (params: unknown) => ['get-shared-scans', params] as const,
  detailRoot: () => ['get-shared-scan-by-id'] as const,
  detail: (id: string) => ['get-shared-scan-by-id', id] as const,
} as const;

export const scanTypeKeys = {
  list: () => ['get-scan-types'] as const,
  items: (scanTypeId: string) => ['get-scan-type-items', scanTypeId] as const,
  filter: () => ['get-scan-types-filter'] as const,
  full: () => ['get-scan-type-full'] as const,
  filterOptions: () => ['get-scan-type-filter-options'] as const,
  organizations: (userId: string) => ['get-scan-type-organizations', userId] as const,
  orgList: (organizationId: string) => ['get-organization-scan-types', organizationId] as const,
  orgItems: (organizationId: string, scanTypeId: string) =>
    ['get-organization-scan-type-items', organizationId, scanTypeId] as const,
  orgForms: (organizationId: string, scanTypeId: string | null) =>
    ['get-organization-forms', organizationId, scanTypeId] as const,
  form: (formId: string) => ['get-scan-form', formId] as const,
  formsByIds: (formIds: string[]) => ['get-scan-form-by-ids', formIds] as const,
} as const;

export const groupKeys = {
  /** Keyed by keyword AND page: the server does the matching, so each keyword
   *  is a different result set rather than a client-side view of one. */
  filterOptions: (keyword: string, page: number) =>
    ['get-group-filter-options', keyword, page] as const,
  /** Prefix for every page of the group index, across both scoped endpoints. */
  listRoot: () => ['get-groups'] as const,
  list: (params: unknown) => ['get-groups', params] as const,
  /** Prefix for every page of one group's member list. */
  membersRoot: (groupId: string) => ['get-group-members', groupId] as const,
  members: (groupId: string, params: unknown) => ['get-group-members', groupId, params] as const,
} as const;

export const authKeys = {
  session: () => ['auth-session'] as const,
} as const;

/** A leader's own led-groups, each carrying its scan-notification preference. */
export const notificationPreferenceKeys = {
  list: () => ['group-notification-preferences'] as const,
} as const;

/**
 * Mutation keys, for useIsMutating checks and devtools readability. The two
 * legacy mutations that carried no key (updateScanById, deleteScanById) get
 * one here so the set is complete.
 */
export const mutationKeys = {
  login: () => ['login'] as const,
  logout: () => ['logout'] as const,
  updateScan: () => ['update-scan'] as const,
  deleteScan: () => ['delete-scan'] as const,
  createScan: () => ['create-scan'] as const,
  addScanReview: () => ['add-scan-review'] as const,
  addScanNote: () => ['add-scan-note'] as const,
  deleteScanNote: () => ['delete-scan-note'] as const,
  addScanTag: () => ['add-scan-tag'] as const,
  removeScanTag: () => ['remove-scan-tag'] as const,
  addScanFiles: () => ['add-scan-files'] as const,
  attachScanFile: () => ['attach-scan-file'] as const,
  deleteScanFiles: () => ['delete-scan-files'] as const,
  updateFileDetailsStatus: () => ['update-file-details-status'] as const,
  resetScanUpload: () => ['reset-scan-upload'] as const,
  uploadPresign: () => ['upload-presign'] as const,
  multipartUploadInit: () => ['upload-init'] as const,
  multipartUploadComplete: () => ['upload-complete'] as const,
  requestScanReview: () => ['request-expert-scan-review'] as const,
  requestExpertScanReview: () => ['request-expert-scan-review-expert'] as const,
  purchaseScanCredits: () => ['purchase-scan-credits'] as const,
  createSharedScan: () => ['create-shared-scan'] as const,
  updateSharedScan: () => ['update-shared-scan'] as const,
  deleteSharedScan: () => ['delete-shared-scan'] as const,
  exportGroupUserScans: () => ['export-group-user-scans'] as const,
  exportGroupsUserScans: () => ['export-groups-user-scans'] as const,
  sendPasswordResetOtp: () => ['send-password-reset-otp'] as const,
  verifyPasswordResetOtp: () => ['verify-password-reset-otp'] as const,
  resetPassword: () => ['reset-password'] as const,
  confirmGroupInvitation: () => ['confirm-group-invitation'] as const,
  updateGroupNotificationPreference: () => ['update-group-notification-preference'] as const,
  deleteAccount: () => ['delete-account'] as const,
} as const;
