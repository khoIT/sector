import type { Document } from 'mongodb';

import { accountUserSchema } from '../schemas/account';
import { authRoleSchema, authUserSchema } from '../schemas/auth';
import { mediaFileSchema, userGroupSchema } from '../schemas/common';
import {
  findingDefinitionSchema,
  organizationSchema,
  scanTypeSummarySchema,
} from '../schemas/create-scan-lookups';
import { groupFilterOptionSchema } from '../schemas/group-filter';
import {
  scanFindingSchema,
  scanNoteSchema,
  scanReviewSchema,
  scanSchema,
  scanTypeRefSchema,
} from '../schemas/scan';
import { scanTypeFilterOptionSchema } from '../schemas/scan-type-filter';
import { scanFormFieldSchema, scanFormSchema, scanTypeItemSchema } from '../schemas/scan-type';
import { scanShareSchema } from '../schemas/shared-scan';
import { sharedScanDetailSchema } from '../schemas/shared-scan-detail';
import { sharedScanListItemSchema } from '../schemas/shared-scan-list';
import { populatedUser } from './projections/common';
import {
  prefetchScans,
  projectScan,
  projectScanReview,
  projectSharedScanSummary,
} from './projections/scan';
import type { ReplayEntry } from './replay';
import { pick, toWire } from './wire';

/**
 * Which production collection proves which schema, and how.
 *
 * This is the register `pnpm fidelity` runs and the register the manifest
 * guard reads: a schema exported from src/schemas that appears in no entry's
 * `proves` and is not excused in NOT_REPLAYED fails the ordinary unit run, so
 * a new route family cannot ship without deciding how its shape is tested
 * against real data.
 *
 * Each `project` reproduces what the API does to a raw document on the way
 * to the wire — the toJSON transform, the populates the service performs, the
 * mapper's reshaping — and nothing more. When a projection has to guess at
 * the API's behaviour, the guess is written down beside it.
 */

const raw = (doc: Document) => toWire(doc);

export const REPLAY_ENTRIES: readonly ReplayEntry[] = [
  {
    name: 'scans → GET /api/scan/:id/get',
    collection: 'scans',
    schema: scanSchema,
    proves: [
      'scanSchema',
      'scanStatusSchema',
      'refIdSchema',
      'scanFindingSchema',
      'scanFormValueSchema',
      'scanFormResponseSchema',
      'scanLogSchema',
      'fileDetailSchema',
      'aiScanQualitySchema',
      'competencyMeasureSchema',
      'customReviewSchema',
      'scanReviewSchema',
      'embeddedScanNoteSchema',
      'scanTypeRefSchema',
      'mediaFileSchema',
      'fileStatusSchema',
      'scanGroupRefSchema',
      'scanGroupListSchema',
      'userBasicSchema',
    ],
    prefetch: prefetchScans,
    project: projectScan,
  },
  {
    name: 'files → media object on a scan',
    collection: 'files',
    schema: mediaFileSchema,
    proves: ['mediaFileSchema', 'fileStatusSchema'],
    project: (file) => ({
      ...(toWire(pick(file, ['filename', 'filesize', 'filetype', 'filepath'])) as Record<
        string,
        unknown
      >),
      status: file.status || 'completed',
      url: null,
      urlThumbnail: null,
      url360: null,
      url480: null,
      url720: null,
    }),
  },
  {
    name: 'scanreviews → scan.review',
    collection: 'scanreviews',
    schema: scanReviewSchema,
    proves: ['scanReviewSchema', 'competencyMeasureSchema', 'customReviewSchema', 'refIdSchema'],
    prefetch: async (_batch, { refs }) => refs.loadAll('users'),
    project: projectScanReview,
  },
  {
    name: 'scannotes → GET /api/scan/:id/notes item',
    collection: 'scannotes',
    schema: scanNoteSchema,
    proves: ['scanNoteSchema', 'scanNoteListSchema'],
    prefetch: async (batch, { refs }) => {
      await refs.loadAll('users');
      await refs.prefetch(
        'scans',
        batch.map((note) => note.scan),
      );
    },
    project: (note, { refs }) => {
      // scanNoteService.getAll: populate scan (select title) and user.
      const scan = refs.get('scans', note.scan);
      return {
        ...(toWire(note) as Record<string, unknown>),
        user: populatedUser(refs, note.user),
        scan: scan ? { id: String(scan._id), title: scan.title } : null,
      };
    },
  },
  {
    name: 'scanfindings → scan.findings[]',
    collection: 'scanfindings',
    schema: scanFindingSchema,
    proves: ['scanFindingSchema'],
    project: (finding) => ({ id: String(finding._id), key: finding.key, value: finding.value }),
  },
  {
    name: 'sharedscans → POST /api/shared-scans result item',
    collection: 'sharedscans',
    schema: scanShareSchema,
    proves: ['scanShareSchema'],
    project: raw,
  },
  {
    name: 'sharedscans → GET /api/shared-scans list item',
    collection: 'sharedscans',
    schema: sharedScanListItemSchema,
    proves: ['sharedScanListItemSchema', 'sharedScanStatusSchema', 'sharedScanScanSummarySchema'],
    prefetch: async (batch, context) => {
      const { refs } = context;
      await Promise.all([refs.loadAll('users'), refs.loadAll('scantypes')]);
      await refs.prefetch(
        'scans',
        batch.map((share) => share.scan),
      );
      const scans = batch
        .map((share) => refs.get('scans', share.scan))
        .filter(Boolean) as Document[];
      await refs.prefetch(
        'files',
        scans.flatMap((scan) => (Array.isArray(scan.files) ? scan.files : [])),
      );
    },
    project: (share, context) => {
      const scan = context.refs.get('scans', share.scan);
      return {
        ...(toWire(share) as Record<string, unknown>),
        sharedBy: populatedUser(context.refs, share.sharedBy),
        scan: scan ? projectSharedScanSummary(scan, context) : null,
      };
    },
  },
  {
    name: 'sharedscans → GET /api/shared-scans/:id',
    collection: 'sharedscans',
    schema: sharedScanDetailSchema,
    proves: ['sharedScanDetailSchema', 'sharedScanDetailScanSchema'],
    prefetch: async (batch, context) => {
      const { refs } = context;
      await refs.prefetch(
        'scans',
        batch.map((share) => share.scan),
      );
      const scans = batch
        .map((share) => refs.get('scans', share.scan))
        .filter(Boolean) as Document[];
      await prefetchScans(scans, context);
    },
    project: (share, context) => {
      const scan = context.refs.get('scans', share.scan);
      return {
        ...(toWire(share) as Record<string, unknown>),
        sharedBy: populatedUser(context.refs, share.sharedBy),
        scan: scan ? projectScan(scan, context) : null,
      };
    },
  },
  {
    name: 'groups → GET /api/scan/user-groups item',
    collection: 'groups',
    schema: userGroupSchema,
    proves: ['userGroupSchema'],
    prefetch: async (_batch, { refs }) => refs.loadAll('groups'),
    project: (group, { refs }) => {
      const parent = refs.get('groups', group.parent);
      return {
        id: String(group._id),
        name: group.name,
        slug: group.slug,
        parent: parent ? { id: String(parent._id), name: parent.name, slug: parent.slug } : null,
      };
    },
  },
  {
    name: 'groups → GET /api/groups/filter-options item',
    collection: 'groups',
    schema: groupFilterOptionSchema,
    proves: ['groupFilterOptionSchema', 'groupFilterOptionsPageSchema'],
    project: (group) => ({ id: String(group._id), name: group.name }),
  },
  {
    name: 'scantypes → scan.scanType',
    collection: 'scantypes',
    schema: scanTypeRefSchema,
    proves: ['scanTypeRefSchema'],
    project: (scanType) => toWire(pick(scanType, ['key', 'name', 'version', 'questions'])),
  },
  {
    name: 'scantypes → GET /api/scan-type item',
    collection: 'scantypes',
    schema: scanTypeSummarySchema,
    proves: ['scanTypeSummarySchema'],
    // The route presigns `imagePath` into `imageUrl`; from a dump that is null.
    project: (scanType) => ({ ...(toWire(scanType) as Record<string, unknown>), imageUrl: null }),
  },
  {
    name: 'scantypes → GET /api/scan-type/filter-options item',
    collection: 'scantypes',
    schema: scanTypeFilterOptionSchema,
    proves: ['scanTypeFilterOptionSchema'],
    project: (scanType) => ({ name: scanType.name, baseKey: scanType.baseKey }),
  },
  {
    name: 'scantypeitems → GET /api/scan-type/:id/items item',
    collection: 'scantypeitems',
    schema: scanTypeItemSchema,
    proves: ['scanTypeItemSchema'],
    project: raw,
  },
  {
    name: 'scantypeitems → finding definition',
    collection: 'scantypeitems',
    schema: findingDefinitionSchema,
    proves: ['findingDefinitionSchema', 'findingDefinitionsResponseSchema', 'scanTypeItemsSchema'],
    prefetch: async (_batch, { refs }) => refs.loadAll('scantypeitems'),
    project: (item, { refs }) => {
      const parent = refs.get('scantypeitems', item.parent);
      return {
        ...(toWire(item) as Record<string, unknown>),
        parent: parent ? toWire(pick(parent, ['key', 'name'])) : (toWire(item.parent) ?? null),
      };
    },
  },
  {
    name: 'scanforms → GET /api/scan-type/:id/items form',
    collection: 'scanforms',
    schema: scanFormSchema,
    proves: ['scanFormSchema', 'scanFormFieldSchema', 'scanFormFieldOptionSchema'],
    prefetch: async (batch, { refs }) =>
      refs.prefetchChildren(
        'scanformfields',
        'form',
        batch.map((form) => form._id),
      ),
    project: (form, { refs }) => ({
      ...(toWire(form) as Record<string, unknown>),
      fields: refs
        .children('scanformfields', 'form', form._id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(raw),
    }),
  },
  {
    name: 'scanformfields → form field',
    collection: 'scanformfields',
    schema: scanFormFieldSchema,
    proves: ['scanFormFieldSchema', 'scanFormFieldOptionSchema'],
    project: raw,
  },
  {
    name: 'organizations → GET /api/organizations/user item',
    collection: 'organizations',
    schema: organizationSchema,
    proves: ['organizationSchema'],
    project: raw,
  },
  {
    name: 'roles → user.role',
    collection: 'roles',
    schema: authRoleSchema,
    proves: ['authRoleSchema'],
    project: raw,
  },
  {
    name: 'users → POST /api/login user',
    collection: 'users',
    schema: authUserSchema,
    proves: ['authUserSchema', 'authRoleSchema', 'scanUserSchema', 'userBasicSchema'],
    /**
     * Only accounts that can sign in. 3,141 of the mirror's 3,151 user
     * documents are stubs — a name and an email, no password, no status, no
     * role — that exist so scan owners resolve. The login route refuses a user
     * whose role does not populate (`User role does not have required
     * permissions`, auth.controller) before it builds a response, so a
     * role-less document never reaches this schema.
     */
    filter: { deletedAt: null, role: { $exists: true } },
    prefetch: async (_batch, { refs }) => refs.loadAll('roles'),
    project: (user, { refs }) => {
      // transformUserPlugin strips the hash; the login route populates the role.
      const { password: _password, ...rest } = user;
      const role = refs.get('roles', user.role);
      return { ...(toWire(rest) as Record<string, unknown>), role: role ? toWire(role) : null };
    },
  },
  {
    name: 'users → GET /api/account/profile',
    collection: 'users',
    schema: accountUserSchema,
    proves: ['accountUserSchema'],
    // The route sits behind authUser, which only an account with a role passes.
    filter: { deletedAt: null, role: { $exists: true } },
    prefetch: async (_batch, { refs }) => refs.loadAll('roles'),
    project: (user, { refs }) => {
      const { password: _password, ...rest } = user;
      const role = refs.get('roles', user.role);
      return { ...(toWire(rest) as Record<string, unknown>), role: role ? toWire(role) : null };
    },
  },
];

/**
 * Schemas that have no production collection to replay, and why.
 *
 * Request payloads describe what THIS client sends; a computed response is
 * assembled per request from several collections and a token or a presign
 * that no dump holds. Each is checked by the live route suite instead.
 */
export const NOT_REPLAYED: Readonly<Record<string, string>> = {
  loginPayloadSchema: 'request body of POST /api/login',
  authSessionSchema:
    'tokens are minted per request; the user inside it is proved by the users entry',
  updateProfilePayloadSchema: 'request body of PUT /api/account/profile',
  updatePasswordPayloadSchema: 'request body of PUT /api/account/password',
  accountPhotoResultSchema: 'a presigned URL minted by POST /api/account/photo',
  scanFilePayloadSchema: 'request body (create/update scan)',
  createScanPayloadSchema: 'request body of POST /api/scan/create',
  scanFileRecordSchema:
    'response of POST /api/scan/:id/add-files, a subset of the File document proved by the files entry',
  createScanResponseSchema: 'response of POST /api/scan/create — a scan proved by the scans entry',
  fileDetailsStatusPayloadSchema: 'request body of PATCH /api/scan/:id/file-details/status',
  fileDetailsStatusResponseSchema: 'response of PATCH /api/scan/:id/file-details/status',
  uploadPresignPayloadSchema: 'request body of POST /api/scan/v2/upload-presign',
  uploadPresignResponseSchema: 'a presigned URL minted per request',
  multipartUploadInitPayloadSchema: 'request body of POST /api/scan/v2/upload-init',
  multipartUploadInitResponseSchema: 'an S3 upload id minted per request',
  multipartUploadCompletePayloadSchema: 'request body of POST /api/scan/upload-complete',
  updateFilePayloadSchema: 'request body',
  updateScanPayloadSchema: 'request body of PUT /api/scan/:id/update',
  scanReviewGroupCreditsSchema:
    'computed per caller from scanreviewrequests and scanreviewpurchases',
  scanReviewCreditsSchema: 'computed per caller from scanreviewrequests and scanreviewpurchases',
  requestExpertReviewPayloadSchema: 'request body of POST /api/scan-review/request',
  creditOptionSchema: 'a constant table in this client',
  purchaseCreditsPayloadSchema: 'request body of POST /api/scan-review/purchase',
  purchaseCreditsResponseSchema: 'a Stripe checkout URL minted per request',
  reviewCompetencyMeasureSchema:
    'the WRITE enum; the stored values are proved by the scanreviews entry',
  addScanReviewPayloadSchema: 'request body of POST /api/scan/:id/review',
  scanReviewResultSchema:
    'response of POST /api/scan/:id/review — a review proved by the scanreviews entry',
  createScanSharePayloadSchema: 'request body of POST /api/shared-scans',
  createScanShareResultSchema:
    'response of POST /api/shared-scans; its items are proved by the sharedscans entry',
  userLogEntrySchema: 'the userlogs collection is in no dump',
  createUserLogsResponseSchema: 'the userlogs collection is in no dump',
  scanFormFieldPayloadSchema: 'request body (form answers as written)',
};
