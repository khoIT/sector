import type { Document } from 'mongodb';
import { z } from 'zod';

import { accountUserSchema } from '../schemas/account';
import { authRoleSchema, authUserSchema } from '../schemas/auth';
import { mediaFileSchema, userGroupSchema } from '../schemas/common';
import {
  findingDefinitionSchema,
  organizationSchema,
  scanTypeSummarySchema,
} from '../schemas/create-scan-lookups';
import {
  courseItemProgressStatusSchema,
  learnerCourseListItemSchema,
  learnerCourseSummarySchema,
} from '../schemas/course';
import { groupSchema } from '../schemas/group';
import { groupFilterOptionSchema } from '../schemas/group-filter';
import { groupMemberSchema } from '../schemas/group-member';
import { groupWithNotificationPreferenceSchema } from '../schemas/group-notification-preferences';
import { questionBankDetailSchema, questionBankSummarySchema } from '../schemas/question-bank';
import { pathologyGalleryItemSchema } from '../schemas/pathology';
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
  groupCourseReachesTheList,
  learnerCourseSummary,
  personalCourseReachesTheList,
  prefetchGroupCourses,
  prefetchPersonalCourses,
  projectGroupCourse,
  projectPersonalCourse,
} from './projections/course';
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
    name: 'groups → GET /api/groups item',
    collection: 'groups',
    schema: groupSchema,
    proves: ['groupSchema', 'groupTypeSchema'],
    prefetch: async (batch, { refs }) => {
      await refs.loadAll('groups');
      const ids = batch.map((group) => group._id);
      // The three counts on a group are Mongoose count-virtuals over the
      // memberships and the group courses that are not soft-deleted.
      await Promise.all([
        refs.prefetchChildren('groupmembers', 'group', ids),
        refs.prefetchChildren('groupcourses', 'group', ids),
      ]);
    },
    project: (group, { refs }) => {
      const parent = refs.get('groups', group.parent);
      const members = refs.children('groupmembers', 'group', group._id);
      return {
        ...(toWire(group) as Record<string, unknown>),
        parent: parent ? { id: String(parent._id), name: parent.name, slug: parent.slug } : null,
        leaderCount: members.filter((member) => member.role === 'leader').length,
        learnerCount: members.filter((member) => member.role === 'learner').length,
        courseCount: refs.children('groupcourses', 'group', group._id).length,
      };
    },
  },
  {
    name: 'groupmembers → GET /api/group-members item',
    collection: 'groupmembers',
    schema: groupMemberSchema,
    proves: ['groupMemberSchema', 'groupMemberRoleSchema', 'groupMemberStatusSchema'],
    prefetch: async (_batch, { refs }) => refs.loadAll('users'),
    // The members aggregation `$unwind`s the joined user, so a membership whose
    // user document is gone never reaches the wire. The mirror's users
    // collection holds scan owners and a handful of accounts, not every
    // member, so here that is most rows — counted, not parsed.
    include: (member, { refs }) => refs.get('users', member.user) !== null,
    project: (member, { refs }) => ({
      ...(toWire(member) as Record<string, unknown>),
      user: populatedUser(refs, member.user),
    }),
  },
  {
    name: 'groupnotifications → GET /api/group-notifications item',
    collection: 'groupnotifications',
    schema: groupWithNotificationPreferenceSchema,
    proves: [
      'groupWithNotificationPreferenceSchema',
      'groupNotificationPreferenceListSchema',
      'notificationTypeSchema',
    ],
    prefetch: async (_batch, { refs }) => refs.loadAll('groups'),
    // The route lists the groups a leader leads and decorates each with its
    // preference; a preference whose group is gone decorates nothing.
    include: (preference, { refs }) => refs.get('groups', preference.group) !== null,
    project: (preference, { refs }) => {
      const group = refs.get('groups', preference.group) as Document;
      // The controller spreads `group.toObject()` and adds two fields; it
      // reads the types only off an ENABLED preference (the lookup filters on
      // emailNotifications), so a disabled one arrives with an empty list.
      const enabled = preference.emailNotifications === true;
      return {
        ...(toWire(group) as Record<string, unknown>),
        notificationsEnabled: enabled,
        notificationTypes: enabled ? toWire(preference.notificationTypes ?? []) : [],
      };
    },
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
  {
    name: 'v2quizzes → GET /api/v2/question-banks item',
    collection: 'v2quizzes',
    schema: questionBankSummarySchema,
    proves: ['questionBankSummarySchema'],
    // getQuestionBanks: `{ isQbank: true, status: PUBLISHED, deletedAt: null }`.
    filter: { isQbank: true, status: 'published', deletedAt: null },
    prefetch: async (batch, { refs }) =>
      refs.prefetch(
        'v2questions',
        batch.flatMap((quiz) => (Array.isArray(quiz.questions) ? quiz.questions : [])),
      ),
    project: (quiz, { refs }) => ({
      ...(toWire(pick(quiz, ['title', 'slug', 'description', 'isQbank'])) as Record<
        string,
        unknown
      >),
      // getPresignedUrl is a live S3 call the replay cannot make; a real API
      // response carries an https URL here instead.
      photoIcon: null,
      // populate({ path: 'questions', select: 'id title slug' }) would drop
      // any reference that does not resolve, the way a populated ARRAY
      // always does (see RefCache.many's doc comment in ../wire.ts) — moot in
      // this mirror, where all 781 unique question ids across the 18
      // published banks' 809 references resolve (the 28-reference gap is 28
      // questions each shared by two banks, not a dangling reference).
      questions: refs
        .many('v2questions', quiz.questions)
        .map((question) => toWire(pick(question, ['title', 'slug']))),
    }),
  },
  {
    name: 'v2quizzes → GET /api/v2/question-banks/:slug',
    collection: 'v2quizzes',
    schema: questionBankDetailSchema,
    proves: [
      'questionBankDetailSchema',
      'questionBankQuestionSchema',
      'questionBankAnswerOptionSchema',
      'questionBankAnswerTypeSchema',
      'questionBankDetailProgressSchema',
      'questionBankRestartInfoSchema',
    ],
    // getBySlug itself filters by nothing but the slug and the soft-delete
    // plugin's deletedAt — but the only slugs this client ever requests are
    // ones the list route surfaced first, so this replays the same set the
    // list entry above does rather than every quiz in the collection.
    filter: { isQbank: true, status: 'published', deletedAt: null },
    prefetch: async (batch, { refs }) =>
      refs.prefetch(
        'v2questions',
        batch.flatMap((quiz) => (Array.isArray(quiz.questions) ? quiz.questions : [])),
      ),
    project: (quiz, { refs }) => ({
      ...(toWire(pick(quiz, ['title', 'slug'])) as Record<string, unknown>),
      // getQbankBySlug: `content: quiz.description`.
      content: quiz.description ?? '',
      photoIcon: null,
      questions: refs.many('v2questions', quiz.questions).map((question) => ({
        ...(toWire(
          pick(question, [
            'title',
            'slug',
            'content',
            'answerType',
            'correctMessage',
            'incorrectMessage',
            'sort',
            'points',
          ]),
        ) as Record<string, unknown>),
        answers: (Array.isArray(question.answers) ? question.answers : []).map((answer) =>
          toWire(pick(answer, ['title', 'mediaUrl', 'allowHtml'])),
        ),
        // No dump holds a session, so every replayed caller is the one
        // getQbankBySlug describes as having no saved answers yet.
        userAnswers: [],
        isAnswered: false,
      })),
      // No dump holds a qbankprogresses attempt either — the branch every
      // replayed caller takes is the one with no attempt under way.
      progress: { canRestart: true, message: 'You can start a new attempt for this quiz' },
    }),
  },
  {
    name: 'v2courses → the course inside a My Courses item',
    collection: 'v2courses',
    schema: learnerCourseSummarySchema,
    proves: ['learnerCourseSummarySchema', 'learnerCourseAuthorSchema'],
    // This entry now also carries the only real risk in `level` and
    // `objectives`: not a wrong value but a missing key. No course document
    // anywhere has either field, so replaying all of them is what proves the
    // schema reads a course authored before the fields existed.
    prefetch: async (_batch, { refs }) => refs.loadAll('users'),
    // The same projection the two list entries below embed, so the course
    // object cannot be proved in one shape here and served in another there.
    project: (course, { refs }) => learnerCourseSummary(refs, course),
  },
  {
    name: 'usercourses → a personal My Courses row',
    collection: 'usercourses',
    schema: learnerCourseListItemSchema,
    proves: [
      'learnerCourseListItemSchema',
      'learnerCourseProgressSchema',
      'learnerCourseMetaVersionSummarySchema',
      'assignmentTypeSchema',
      'enrollmentStatusSchema',
      'expirationTypeSchema',
      'courseProgressStatusSchema',
    ],
    prefetch: prefetchPersonalCourses,
    // `if (!course) continue` — an enrolment whose course document is gone is
    // never serialised.
    include: personalCourseReachesTheList,
    // `progress.lastItemAccessed` is the one field here the replay cannot
    // prove: the route resolves it from a `usercourseprogresses` document the
    // production dumps do not carry (see the section note on that collection),
    // and it is `.nullish()` precisely because a row written before the field
    // existed has no key at all.
    project: projectPersonalCourse,
  },
  {
    name: 'groupcourses → a group-assigned My Courses row',
    collection: 'groupcourses',
    schema: learnerCourseListItemSchema,
    proves: ['learnerCourseGroupSchema'],
    prefetch: prefetchGroupCourses,
    include: groupCourseReachesTheList,
    project: projectGroupCourse,
  },
  {
    name: 'usercourseprogresses → the item statuses the outline serves',
    collection: 'usercourseprogresses',
    schema: z.array(courseItemProgressStatusSchema),
    proves: ['courseItemProgressStatusSchema'],
    // UserCourseProgress has no soft-delete plugin, so every document counts.
    filter: {},
    // buildOutlineProgressItems maps items[].status through untouched; the
    // outline's own status is derived from these and never stored.
    project: (progress) =>
      (Array.isArray(progress.items) ? progress.items : []).map(
        (item: Document) => item.status as unknown,
      ),
  },
  {
    name: 'pathologygalleries → GET /api/pathology-gallery item',
    collection: 'pathologygalleries',
    schema: pathologyGalleryItemSchema,
    proves: ['pathologyGalleryItemSchema', 'pathologyStatusSchema'],
    // Only published items are ever listed by the route (the client always
    // sends status=published) — restrict the replay to the same population,
    // matching the 1,305-item count this schema was verified against.
    filter: { status: 'published' },
    project: raw,
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
  scanFilesMutationResponseSchema:
    'response of POST /api/scan/:id/add-files and DELETE /api/scan/:id/files — a counter plus the File records above, both proved by the scans and files entries',
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
  questionBankAttemptInfoSchema:
    'the in-progress branch of a qbankprogresses attempt; no dump holds a live session, so no replayed caller ever produces this branch of the union — only questionBankRestartInfoSchema is proved',
  questionBankProgressResultSchema:
    'response of GET /api/v2/question-banks/progress/:quizId, assembled per caller from a qbankprogresses attempt no dump holds',
  saveQuestionBankProgressPayloadSchema:
    'request body of POST /api/v2/question-banks/save-progress',
  saveQuestionBankProgressResultSchema:
    'response of POST /api/v2/question-banks/save-progress — an echo of the request plus a flag, not a stored document',
  checkQuestionBankAnswersPayloadSchema:
    'request body of POST /api/v2/question-banks/check-answers',
  checkQuestionBankAnswersResultSchema:
    "a scored attempt computed per request from qbankprogresses and the quiz's questions; no dump holds a session to replay",
  questionBankResultQuestionSchema:
    'a per-question grade inside checkQuestionBankAnswersResultSchema, computed per request rather than stored',
  questionBankAnswerRefSchema:
    'an answer echoed back inside the check-answers result; its stored shape is proved by questionBankAnswerOptionSchema instead',
  forgotPasswordPayloadSchema: 'request body of POST /api/forgot-password/send-otp',
  forgotPasswordResultSchema: 'a step token minted per request',
  verifyForgotPasswordOtpPayloadSchema: 'request body of POST /api/forgot-password/verify-otp',
  verifyForgotPasswordOtpResultSchema: 'a step token minted per request',
  resetPasswordPayloadSchema: 'request body of POST /api/forgot-password/reset',
  confirmGroupInvitationPayloadSchema: 'request body of POST /api/group-members/confirm-invitation',
  confirmGroupInvitationResultSchema:
    'three ids echoed back by the confirmation; the membership itself is proved by the groupmembers entry',
  updateGroupNotificationPreferencePayloadSchema:
    'request body of PUT /api/group-notifications/:groupId',
  deleteAccountPayloadSchema: 'request body of DELETE /api/account/delete',

  scanTagPayloadSchema: 'request body of POST/DELETE /api/scan/:id/tags',
  // The course outline. Every shape below is assembled by
  // learners.outline.helper.ts's traversal of a course-meta structure, joined
  // against lesson/topic/quiz documents and the learner's own progress items:
  // no collection holds a row of it, and emulating the traversal here would
  // test this package against a second implementation of the thing it is
  // meant to check. They are covered end to end by the route replay in
  // ./routes.fidelity.test.ts instead, which asks the running mirror API for
  // the outline of every course the seeded learner is enrolled in — so what
  // would have to exist for a COLLECTION replay to prove them is a stored,
  // resolved outline document, which this API has never had.
  //
  // The one piece of the outline that IS stored — the per-item status the
  // traversal passes straight through — is replayed above from
  // usercourseprogresses, because that is the field whose fourth value
  // (`failed`) this client did not model.
  courseOutlineItemKindSchema:
    'computed by the traversal from the structure node type; route replay: learner outline responses',
  courseOutlineBlockedReasonSchema:
    'computed by the traversal from the non-deleted question count; route replay: learner outline responses',
  courseOutlineQuizSummarySchema:
    "assembled per quiz from the learner's own attempts; route replay: learner outline responses",
  courseOutlineResumeSchema:
    'computed by the traversal from item order and status; route replay: learner outline responses',
  courseOutlineItemSchema:
    "one resolved item: a structure node joined to its content document and the learner's progress; route replay: learner outline responses",
  courseOutlineSchema:
    'the whole resolved outline; route replay: GET /api/v2/learners/courses/:courseId/outline for every seeded enrolment',
  // The envelope, not the row. getLearnersCourses paginates in memory after
  // normalizeLearnerCourses has merged the two branches and split the expired
  // rows off, so page/totalPages/items/expired exist only in a response: a
  // collection replay would have to reimplement that merge to produce one.
  // The rows inside it are replayed from both branches above.
  learnerCoursesPageSchema:
    'assembled by the controller from both branches; route replay: every page of GET /api/v2/learners/courses',
  // ─── group administration: write forms, exports, assignments ────────────
  createGroupPayloadSchema: 'request body of POST /api/groups',
  updateGroupPayloadSchema: 'request body of PUT /api/groups/:id',
  groupWriteResultSchema:
    'response of POST /api/groups and PUT /api/groups/:id — a Group.toObject() ' +
    'without the getAll() count-virtual aggregation; the persisted document is ' +
    'proved by the groupSchema entry, only the echoed id/name/slug are read here',
  inviteGroupMemberPayloadSchema: 'request body of POST /api/group-members/invite',
  inviteGroupMemberResultSchema:
    'isNewUser is computed per request; the created membership is proved by the groupmembers entry',
  addExistingUserToGroupPayloadSchema: 'request body of POST /api/group-members/add-existing-user',
  reInviteGroupMemberPayloadSchema: 'request body of POST /api/group-members/re-invite',
  updateGroupMemberRolePayloadSchema: 'request body of PUT /api/group-members/:id',
  exportFileResultSchema:
    'a generated xlsx workbook assembled per request from scans/course-progress ' +
    'collections; not a document any dump holds',
  groupScanReportEntrySchema:
    'a computed, pre-formatted report row (class/course/member completion), aggregated ' +
    'per request rather than read off one stored document',
  createGroupAssignmentPayloadSchema: 'request body of POST /api/group-assignment',
  groupAssignmentSchema:
    'the groupassignments collection exists in the production mirror, but this ' +
    "route's populate paths (groupAssignmentService.getAll) are not yet verified " +
    'closely enough to write a faithful projection; modelled defensively ' +
    '(user as string | UserBasic) pending that verification rather than guessed at',
  groupLearnerSchema:
    'a computed pairing of an active group membership and its user, assembled per ' +
    'request by GET /group-assignment/learners rather than read off one stored document',
  groupCourseOptionSchema:
    'a computed pairing of a group and one of its courses, assembled per request by ' +
    'GET /group-assignment/group-courses rather than read off one stored document',
  groupCourseSchema:
    'the groupcourses collection exists in the mirror, but this route sends the ' +
    "populated course document directly and the exact populate/projection isn't " +
    'yet verified; modelled minimally against only the fields this list renders',

  // ─── course runner: progress writes, per-question quiz submit, content ──
  // The write side of the seam Phase 6 read from. `usercourseprogresses` and
  // `usercourseactivities` hold NO real production data at all: the dumps
  // carry only "content and scan collections" (see the repo README), and a
  // direct query of the mirror confirms it — every `usercourseprogresses`
  // document present (5, all of them) was written by
  // `scripts/data/seed-course-progress.ts` driving this exact API, not
  // restored from production. That is the answer to this phase's own risk
  // note: the shape below is not guessed and is not `z.any()` — it is read
  // straight off one of those five real, persisted (if synthetic) documents
  // (course `681a4b5b779a0d9e6c9cc52e`, three completed quiz items, 100%
  // each, verified 14 Sep 2026) and cross-checked against the Mongoose
  // schema that writes it (`user-course-progress.model.ts`) — but no
  // PRODUCTION document will ever exist to replay it against, the same
  // structural gap `questionBankAttemptInfoSchema` documents for qbank
  // sessions below.
  trackContentTypeSchema: 'request body enum of POST /api/v2/learners/courses/:courseId/track',
  trackCourseProgressPayloadSchema: 'request body of POST /api/v2/learners/courses/:courseId/track',
  trackItemPositionPayloadSchema:
    'request body of POST /api/v2/learners/courses/:courseId/items/:itemId/position — ' +
    'one field, seconds observed; the server reads the runtime from v2topicmedia rather ' +
    'than trusting a duration from the client',
  trackItemPositionResultSchema:
    'minted per request by the position route: the seconds it actually stored, floored, ' +
    'plus whether that write crossed the watched threshold — nothing persists this shape',
  trackCourseQuizProgressPayloadSchema:
    'request body of POST /api/v2/learners/courses/:courseId/quizzes/:quizId/track',
  trackCourseQuizProgressResultSchema:
    'one question, graded per request by learners.quiz.track.ts#trackQuizAnswer; ' +
    'no usercourseprogresses document holds this narrower echo shape — see quizAttemptAnswerSchema',
  retakeCourseQuizResultSchema:
    'an echo of the attempt POST /quizzes/:quizId/retake just opened, minted per request',
  quizAttemptAnswerSchema:
    'one graded answer inside a quizAttempts[].answers[] entry; usercourseprogresses ' +
    'holds no production data at all (see the section note above) — verified instead ' +
    'against a real document this API wrote when driven by scripts/data/seed-course-progress.ts',
  quizAttemptSchema:
    'one quizAttempts[] entry; same verification and same absence of production data as ' +
    'quizAttemptAnswerSchema',
  quizItemProgressStatusSchema:
    "the item-level ProgressStatus enum (user-course-progress.model.ts), including 'failed' " +
    '— usercourseprogresses holds no production data to replay this against',
  courseQuizProgressEntrySchema:
    'assembled per learner-course-quiz pair from usercourseprogresses (no production data) ' +
    'joined with v2quizzes',
  courseQuizProgressResultSchema: 'the envelope around courseQuizProgressEntrySchema',
  courseContentBodySchema:
    'a trivial id/title/content/status projection of v2lessons or v2topics, both real ' +
    'production content collections in the mirror — not wired into the replay harness ' +
    'this phase (no join, no computed field, negligible parse risk against either collection)',
  courseQuizQuestionSchema:
    'the same v2questions documents questionBankDetailSchema already replays, read through ' +
    "this course-quiz route's narrower shape instead — not separately wired this phase",
  courseQuizDetailSchema: 'the envelope around courseQuizQuestionSchema; see its entry',

  // ─── the read-only admin/learner-course-detail view ──────────────────────
  learnerCourseAdminDetailSchema:
    'GET /dashboard/learner-course-detail assembles this per request from UserCourse, ' +
    'GroupMember/GroupCourse and UserCourseProgress the same way the My Courses row does ' +
    '(learnerCourseListItemSchema, above) — no single collection holds it',
  learnerCourseAdminResultSchema:
    'the envelope around learnerCourseAdminDetailSchema, plus the ' +
    "target learner's id/name resolved per request",
  // ─── home-screen dashboards: 8 computed aggregate endpoints ──────────────
  // Every schema below is assembled per request across usercourseprogresses,
  // scans, v2quizzes/qbankprogresses and groupmembers — the same reason
  // learnerCourseListItemSchema above has no collection replay. Proved
  // instead by `fidelity/dashboard-routes.fidelity.test.ts`, which walks all
  // eight routes through the running mirror API for every seeded role —
  // stronger than a synthetic projection here would be for a response this
  // computed.
  //
  // What that replay does and does not reach, measured rather than assumed:
  // every ENVELOPE is parsed for all four seeded accounts, but only
  // learner@sector.test has learning history in the mirror, so each ROW schema
  // below is proved by that one account's rows (9 courses, 1 question bank,
  // 17 topics, 10 quizzes) while the other three contribute empty lists, which
  // satisfy an item schema without exercising it. Where a shape has no live
  // instance at all, the entry says so rather than claiming otherwise.
  // Note: `courseProgressStatusSchema` already has an entry above (shared
  // with My Courses — see the doc comment on the import in
  // schemas/dashboard.ts) — not repeated here, since a manifest key can only
  // ever be excused once.
  courseProgressSegmentSchema:
    'one status bucket of course-progress-chart, computed per request from a ' +
    "learner's course structure and progress items; proved live",
  courseProgressChartSchema:
    'GET /api/dashboard/course-progress-chart — a module-completion count ' +
    'assembled per learner/course pair, not stored; proved live',
  groupCourseProgressSegmentSchema:
    'one status bucket of the group course-progress chart, computed per ' +
    'request by counting group members by course status; proved live',
  groupCourseProgressChartSchema:
    "part of GET /api/dashboard/charts — a group's learner counts by course " +
    'status, assembled per request; proved live',
  dashboardGroupChartsSchema:
    'GET /api/dashboard/charts — the envelope around the course chart above; its ' +
    'scanProgressChart field is deliberately not parsed, being unscoped for a group ' +
    'with no learners (see the schema); proved live',
  scanProgressByUserItemSchema:
    'one status bucket of GET /api/dashboard/scan-progress-by-user, computed ' +
    'per request from live scanService counts; proved live',
  scanProgressByUserSchema: 'GET /api/dashboard/scan-progress-by-user; proved live',
  qbankStatsItemSchema:
    'one question bank row of GET /api/dashboard/qbank-stats, assembled per ' +
    'request from qbankprogresses attempts; proved live',
  qbankStatsSchema: 'GET /api/dashboard/qbank-stats; proved live',
  topicProgressItemSchema:
    'one topic row of GET /api/dashboard/topic-progress-by-user, assembled per ' +
    'request from course structure and progress items; proved live',
  topicProgressSchema: 'GET /api/dashboard/topic-progress-by-user; proved live',
  quizProgressItemSchema:
    'one quiz row of GET /api/dashboard/quiz-progress-by-user, assembled per ' +
    'request from v2quizzes and progress items; proved live',
  quizProgressSchema: 'GET /api/dashboard/quiz-progress-by-user; proved live',
  topCourseProgressItemSchema:
    'one course row of GET /api/dashboard/top-course-progress, read off ' +
    'usercourseprogresses and ranked per request rather than stored pre-ranked; proved live',
  topCourseProgressSchema: 'GET /api/dashboard/top-course-progress; proved live',
  courseCompletionTimelineEventSchema:
    'one activity-log entry inside a day of GET /api/dashboard/course-completion-timeline, ' +
    "built per request from a learner's progress items. NOT proved live: every day " +
    'the replay has ever returned carries an empty events array (checked across all ' +
    "nine of the seeded learner's courses), so this shape is modelled from the " +
    'controller only and no live instance has been parsed',
  courseCompletionTimelineDaySchema:
    'one day of GET /api/dashboard/course-completion-timeline, a cumulative ' +
    'progress computation with no stored per-day record; proved live',
  courseCompletionTimelineSchema: 'GET /api/dashboard/course-completion-timeline; proved live',
  // Pathology gallery category bar: joins the pathologygalleries.scanTypeId
  // relation (proved directly by pathologyGalleryItemSchema above) against
  // scantypes for a name and a presigned imagePath, plus the small set of
  // published categories with no scanTypeId. Neither half is a single
  // collection's document shape, and the join itself is what the category
  // bar IS, so there is nothing left to replay once the relation is proved.
  pathologyCategorySchema:
    'computed per request by joining distinct pathologygalleries.scanTypeId values (and unmapped category names) against scantypes; the relation itself is proved by pathologyGalleryItemSchema',

  // Group assignments: GET /api/group-assignment/group/:groupId populates
  // `user` and `contentId` (plus courseId/lessonId/topicId) onto a
  // GroupAssignment row. `contentId` is polymorphic — a V2Course, V2Lesson,
  // V2Topic or V2Quiz document depending on `contentRefModel` — so proving it
  // needs a projection that branches per row on that field. Checked instead by
  // schemas/group-assignment.test.ts against rows captured from the live
  // route, including the two shapes a replay could not have found because
  // neither is stored: a `user` that populated to null, and a `contentId`
  // reduced from a full content document.
  assignmentContentRefSchema:
    'contentId/courseId/lessonId/topicId are polymorphic (course/lesson/topic/quiz) populated refs on a GroupAssignment row; see groupAssignmentSchema',
  groupAssignmentTypeSchema:
    'the value of groupassignments.assignmentType, assembled into groupAssignmentSchema',
  groupAssignmentStatusSchema:
    'the value of groupassignments.status, assembled into groupAssignmentSchema',
};
