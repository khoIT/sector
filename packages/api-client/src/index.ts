/**
 * @scanvault/api-client — the typed client over the legacy GUSI API.
 *
 * Conventions that hold everywhere in this package:
 *   - Every failure throws an ApiError. Nothing resolves with `{success:false}`.
 *   - Every response with a schema is `.parse()`d, not cast.
 *   - Query and mutation keys come from the factories in query-keys.ts.
 *   - Nothing here imports a UI library, a toast, or the router.
 *
 * WHAT IS IMPLEMENTED: the transport, the shared primitives (list query, key
 * factories, scan-status helpers, S3 key helpers), auth, and every endpoint the
 * four feature surfaces need — scan list/detail, shared scans, scan types and
 * filter options, review submit, review credits, notes, sharing, and upload
 * (presign, single-shot PUT and multipart).
 *
 * HOW TO ADD ONE: a new schema file under src/schemas/, a new endpoint file
 * under src/endpoints/, a hooks file under src/react/, and an export block
 * here. Do not widen an existing file that models a different route family —
 * `scan-review-submit` (POST /api/scan/:id/review) and `scan-review-credits`
 * (/api/scan-review/*) are separate for exactly that reason.
 *
 * Cache keys come from query-keys.ts. Never inline a key array at a call site.
 */

// ─── transport ────────────────────────────────────────────────────────────────
export {
  createClient,
  encodeQuery,
  type ApiClient,
  type CreateClientOptions,
  type HttpMethod,
  type QueryInput,
  type QueryValue,
  type RequestOptions,
  type ResponseSchema,
  type UnauthorizedContext,
} from './client';

export {
  ApiError,
  isAbortError,
  isApiError,
  type ApiErrorInit,
  type ApiErrorKind,
} from './errors';

export {
  envelopeData,
  envelopeDetails,
  envelopeMessage,
  isErrorEnvelope,
  paginatedSchema,
  type Paginated,
} from './envelope';

export {
  createSessionStore,
  SESSION_STORAGE_KEY,
  type SessionStore,
} from './session-store';

// ─── list query + cache keys ──────────────────────────────────────────────────
export {
  ALLOWED_SORT_FIELDS,
  buildListQuery,
  clampPageSize,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  isAllowedSortField,
  LIST_SEARCH_DEBOUNCE_MS,
  MAX_PAGE_SIZE,
  normalizeSortField,
  SCAN_LIST_FILTER_KEYS,
  SHARED_SCAN_LIST_FILTER_KEYS,
  type ColumnFilter,
  type ListQueryInput,
  type PaginationSpec,
  type ScanListFilterKey,
  type SharedScanListFilterKey,
  type SortField,
  type SortSpec,
} from './list-query';

export {
  authKeys,
  mutationKeys,
  noteKeys,
  reviewKeys,
  SCAN_LIST_VIEWS,
  scanKeys,
  scanTypeKeys,
  sharedScanKeys,
  type ScanListView,
} from './query-keys';

// ─── domain helpers ───────────────────────────────────────────────────────────
export {
  FILE_STATUSES,
  hasProcessingScan,
  PROCESSING_POLL_MS,
  SCAN_STATUS_LABEL,
  SCAN_STATUSES,
  scanStatusTone,
  uploadOutcomeFor,
  type FileStatus,
  type ScanStatus,
  type StatusTone,
  type UploadOutcome,
} from './scan-status';

export {
  buildScanFilekey,
  extractFilekey,
  putToPresignedUrl,
  sanitizeFilename,
  type PresignedPutResult,
} from './upload-keys';

// ─── schemas + types ──────────────────────────────────────────────────────────
export {
  fileStatusSchema,
  isPendingFilePlaceholder,
  mediaFileSchema,
  scanGroupRefSchema,
  userBasicSchema,
  userDisplayName,
  userGroupSchema,
  type FileStatusValue,
  type MediaFile,
  type ScanGroupRef,
  type UserBasic,
  type UserGroup,
} from './schemas/common';

export {
  authRoleSchema,
  authSessionSchema,
  authUserSchema,
  hasAnyPermission,
  hasPermission,
  loginPayloadSchema,
  type AuthRole,
  type AuthSession,
  type AuthUser,
  type LoginPayload,
} from './schemas/auth';

export {
  aiScanQualitySchema,
  competencyMeasureSchema,
  customReviewSchema,
  embeddedScanNoteSchema,
  fileDetailSchema,
  scanFindingSchema,
  scanFormFieldPayloadSchema,
  scanFormResponseSchema,
  scanFormValueSchema,
  scanLogSchema,
  scanNoteListSchema,
  scanNoteSchema,
  scanReviewSchema,
  scanSchema,
  scanStatusSchema,
  scanTypeRefSchema,
  scanUserSchema,
  type AiScanQuality,
  type CompetencyMeasure,
  type EmbeddedScanNote,
  type FileDetail,
  type Scan,
  type ScanFinding,
  type ScanFormFieldPayload,
  type ScanFormResponse,
  type ScanLog,
  type ScanNote,
  type ScanNoteList,
  type ScanReview,
  type ScanTypeRef,
  type ScanUser,
} from './schemas/scan';

export {
  createScanSharePayloadSchema,
  createScanShareResultSchema,
  scanShareSchema,
  scanShareScanId,
  type CreateScanSharePayload,
  type CreateScanShareResult,
  type ScanShare,
} from './schemas/shared-scan';

export {
  sharedScanDetailSchema,
  sharedScanDetailScanSchema,
  type SharedScanDetail,
  type SharedScanDetailScan,
  type SharedScanNote,
} from './schemas/shared-scan-detail';

// ─── endpoints ────────────────────────────────────────────────────────────────
export { getCurrentUser, login } from './endpoints/auth';

export {
  getScanById,
  getScanList,
  getScanUserGroups,
  getScanUsers,
  scanDetailPath,
  scanListPath,
} from './endpoints/scan';

export { deleteScan } from './endpoints/scan-delete';
export { addScanNote, getScanNotes } from './endpoints/scan-note';
export {
  createScanShare,
  deleteScanShare,
  getSharedScanDetail,
  getSharesForScan,
} from './endpoints/scan-share';
export { getScanTypeItems } from './endpoints/scan-type';

// ─── react ────────────────────────────────────────────────────────────────────
export {
  ApiClientProvider,
  useApiClient,
  type ApiClientProviderProps,
} from './react/api-provider';

export { shouldRetryApiError } from './react/retry';
export { useLoginMutation, useRestoreSessionMutation } from './react/use-auth';
export {
  useScan,
  useScanList,
  useScanUserGroups,
  useScanUsers,
  type UseScanListOptions,
  type UseScanOptions,
} from './react/use-scans';

// ─── shared-scan list (added by the scan-list surface) ────────────────────────
export {
  SHARED_SCAN_STATUS_LABEL,
  sharedScanListItemSchema,
  sharedScanScanSummarySchema,
  sharedScanStatusSchema,
  type SharedScanListItem,
  type SharedScanScanSummary,
  type SharedScanStatus,
} from './schemas/shared-scan-list';

export { getSharedScanList } from './endpoints/shared-scan-list';
export {
  useSharedScanList,
  type UseSharedScanListOptions,
} from './react/use-shared-scans';

// ─── scan-type filter options (added by the scan-list surface) ────────────────
export {
  scanTypeFilterOptionSchema,
  type ScanTypeFilterOption,
} from './schemas/scan-type-filter';

export { getScanTypeFilterOptions } from './endpoints/scan-type-filter';
export { useScanTypeFilterOptions } from './react/use-scan-type-filter-options';

// ─── scan detail surface: review submit, notes, sharing, form definitions ────
export {
  addScanReviewPayloadSchema,
  REVIEW_COMPETENCY_MEASURES,
  reviewCompetencyMeasureSchema,
  scanReviewResultSchema,
  type AddScanReviewPayload,
  type ReviewCompetencyMeasure,
  type ScanReviewResult,
} from './schemas/scan-review-submit';

export { addScanReview } from './endpoints/scan-review-submit';

export {
  useAddScanReviewMutation,
  type AddScanReviewVariables,
} from './react/use-scan-review-submit';
export {
  useAddScanNoteMutation,
  useScanNotes,
  type AddScanNoteVariables,
} from './react/use-scan-notes';
export { useDeleteScanMutation } from './react/use-scan-delete';
export {
  useCreateScanShareMutation,
  useDeleteScanShareMutation,
  useSharedScanDetail,
  useSharesForScan,
} from './react/use-scan-share';
export { useScanTypeItems } from './react/use-scan-types';
export {
  SCAN_FORM_FIELD_TYPES,
  scanFormFieldOptionSchema,
  scanFormFieldSchema,
  scanFormSchema,
  scanTypeItemSchema,
  scanTypeItemsSchema,
  type ScanForm,
  type ScanFormField,
  type ScanFormFieldOption,
  type ScanTypeItem,
  type ScanTypeItems,
} from './schemas/scan-type';

// ─── create-scan surface (added by the create-scan wizard) ───────────────────
export {
  findingDefinitionSchema,
  findingDefinitionsResponseSchema,
  findingParentLabel,
  organizationSchema,
  scanTypeSummarySchema,
  type FindingDefinition,
  type FindingDefinitionsResponse,
  type FindingParentRef,
  type Organization,
  type ScanTypeSummary,
} from './schemas/create-scan-lookups';

export {
  createScanPayloadSchema,
  createScanResponseSchema,
  fileDetailsStatusPayloadSchema,
  multipartUploadCompletePayloadSchema,
  multipartUploadInitPayloadSchema,
  multipartUploadInitResponseSchema,
  scanFilePayloadSchema,
  scanFileRecordSchema,
  updateFilePayloadSchema,
  uploadPresignPayloadSchema,
  uploadPresignResponseSchema,
  type CreateScanPayload,
  type CreateScanResponse,
  type FileDetailsStatusPayload,
  type MultipartUploadInitResponse,
  type ScanFilePayload,
  type ScanFileRecord,
  type UpdateFilePayload,
  type UploadPresignResponse,
} from './schemas/scan-payloads';

export {
  CREDIT_OPTIONS,
  creditOptionSchema,
  purchaseCreditsPayloadSchema,
  purchaseCreditsResponseSchema,
  requestExpertReviewPayloadSchema,
  scanReviewCreditsSchema,
  scanReviewGroupCreditsSchema,
  type CreditOption,
  type PurchaseCreditsPayload,
  type PurchaseCreditsResponse,
  type RequestExpertReviewPayload,
  type ScanReviewCredits,
  type ScanReviewGroupCredits,
} from './schemas/scan-review-credits';

export {
  getFindingDefinitions,
  getOrganizationFindingDefinitions,
  getScanTypes,
  getUserOrganizations,
} from './endpoints/create-scan-lookups';

export {
  multipartUploadComplete,
  multipartUploadInit,
  multipartUploadPart,
  uploadPresign,
} from './endpoints/scan-upload';

export { createScan, updateFileDetailsStatus, updateScanFileStatus } from './endpoints/scan-write';

export {
  getScanReviewCredits,
  purchaseScanReviewCredits,
  requestExpertScanReview,
} from './endpoints/scan-review-credits';

export {
  useFindingDefinitions,
  useScanTypes,
  useUserOrganizations,
} from './react/use-create-scan-lookups';
export {
  useCreateScan,
  useUpdateFileDetailsStatus,
  useUpdateScanFileStatus,
} from './react/use-scan-create';
export {
  usePurchaseScanCredits,
  useRequestExpertScanReview,
  useScanReviewCredits,
} from './react/use-scan-review-credits';

export {
  uploadToPresignedUrl,
  UploadTransferError,
  type UploadProgress,
  type UploadToPresignedUrlOptions,
} from './upload-transfer';

export {
  extensionOf,
  mediaFormatLabel,
  mediaKindFor,
  type MediaKind,
  type MediaKindInput,
} from './media-kind';

export {
  MULTIPART_PART_SIZE,
  MULTIPART_THRESHOLD,
  MultipartEtagError,
  shouldUseMultipart,
  uploadScanObject,
  type MultipartSession,
  type UploadScanObjectOptions,
} from './multipart-upload';
