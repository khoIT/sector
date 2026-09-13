import { GROUP_ADMINISTRATION_PATH, groupMembersPathFor } from '@/features/groups/groups-links';
import { CREATE_SCAN_PATH, SCAN_VAULT_PATH } from '@/features/scan-list/scan-list-views';

/**
 * Every URL the legacy dashboard served, and what happens to it here.
 *
 * This table is the inventory of the replacement. A learner's bookmark, a link
 * in a notification email the API minted last year, a group leader's saved
 * "manage group" tab — each either lands on the surface that took over, or on
 * a page that says the surface was retired and why. Nothing 404s silently,
 * and nothing that was dropped is dropped only in someone's memory: the
 * decommission document is rendered from this file
 * (`pnpm docs:legacy-routes`), so the two cannot disagree.
 *
 * Paths for surfaces that are not built yet are the URL contract those
 * surfaces must honour when they land — the course runner, the gallery, the
 * Sage frame, the home screen. Changing one here is changing the contract.
 *
 * Retirement reasons are keys, not prose: the page renders them through i18n,
 * and the document renders the evidence beside them.
 */

export type RetiredReason =
  | 'commerce'
  | 'certificates'
  | 'fellowship'
  | 'rapid-review'
  | 'referrals'
  | 'resources'
  | 'notifications'
  | 'registration'
  | 'switch-user';

export type LegacyResolution =
  | { kind: 'redirect'; to: string }
  | { kind: 'retired'; reason: RetiredReason; alternative: string }
  | { kind: 'unknown' };

/** Params captured from the legacy path, by name; a missing one reads as ''. */
type Params = Record<string, string | undefined>;

/** A resolution the table can state; `unknown` is only ever computed. */
type Resolved = Exclude<LegacyResolution, { kind: 'unknown' }>;

type LegacyRoute = {
  /** The legacy path, with `:name` params, exactly as the dashboard routed it. */
  legacy: string;
  /** What it was, in a few words, for the decommission document. */
  was: string;
  /** Where it goes now, or why it goes nowhere. */
  resolve: (params: Params) => Resolved;
  /** Evidence for a retirement, or the note a redirect needs. */
  note: string;
};

const redirect = (to: string): Resolved => ({ kind: 'redirect', to });
const retired = (reason: RetiredReason, alternative: string): Resolved => ({
  kind: 'retired',
  reason,
  alternative,
});

/** The Sector paths the not-yet-built surfaces will mount at. */
export const SECTOR_PATH = {
  home: '/',
  profile: '/profile',
  courses: '/learn/courses',
  course: (courseId: string) => `/learn/courses/${courseId}`,
  /** One route serves every nesting shape; the item id is enough. */
  courseItem: (courseId: string, itemId: string) => `/learn/courses/${courseId}/${itemId}`,
  questionBanks: '/learn/question-banks',
  questionBank: (slug: string) => `/learn/question-banks/${slug}`,
  gallery: '/learn/gallery',
  sage: '/learn/sage',
  assignments: '/learn/assignments',
  groups: GROUP_ADMINISTRATION_PATH,
  groupMembers: groupMembersPathFor,
  groupAssignments: (groupId: string) => `${GROUP_ADMINISTRATION_PATH}/${groupId}/assignments`,
  login: '/login',
} as const;

const COMMERCE_NOTE =
  'Every commerce flag is off, the storefront routes are commented out and the checkout ' +
  'submit handler is commented out; 0 orders, 0 subscriptions, 0 payment methods locally. ' +
  'Money flows through scan-review credits, which are bought from the create-scan flow.';

export const LEGACY_ROUTES: readonly LegacyRoute[] = [
  // ─── the shell ──────────────────────────────────────────────────────────────
  {
    legacy: '/dashboard',
    was: 'the dashboard home',
    resolve: () => redirect(SECTOR_PATH.home),
    note: 'The home screen replaces it; until that lands, / forwards to the first permitted list.',
  },
  {
    legacy: '/dashboard/account',
    was: 'account tabs: profile, security, billing, payment methods, settings',
    resolve: () => redirect(SECTOR_PATH.profile),
    note: 'Profile carries name, photo, password, notification preferences and account deletion; the billing tabs are commerce.',
  },
  {
    legacy: '/dashboard/settings',
    was: 'settings: language, theme, devices, notification channels, group notifications',
    resolve: () => redirect(SECTOR_PATH.profile),
    note: 'Language and theme are in the shell; per-group scan notifications are on the profile; push devices had 4 documents against 3,152 users.',
  },
  {
    legacy: '/dashboard/not-authorized',
    was: 'the 403 page',
    resolve: () => redirect(SECTOR_PATH.home),
    note: 'Sector renders its 403 in place, naming the missing permission.',
  },

  // ─── scans ──────────────────────────────────────────────────────────────────
  {
    legacy: '/dashboard/scans',
    was: 'the scans layout',
    resolve: () => redirect(SCAN_VAULT_PATH.my),
    note: '',
  },
  {
    legacy: '/dashboard/scans/my-scans',
    was: 'My Scans',
    resolve: () => redirect(SCAN_VAULT_PATH.my),
    note: '',
  },
  {
    legacy: '/dashboard/scans/my-scans/create',
    was: 'the create-scan wizard',
    resolve: () => redirect(CREATE_SCAN_PATH),
    note: '',
  },
  {
    legacy: '/dashboard/scans/my-scans/:scanId',
    was: 'my scan detail — the path the API writes into every scan notification',
    resolve: ({ scanId = '' }) => redirect(`${SCAN_VAULT_PATH.my}/${scanId}`),
    note: 'These links are in inboxes and histories; they outlive the app that minted them.',
  },
  {
    legacy: '/dashboard/scans/my-scans/:scanId/upload-file',
    was: 'the add-files page for an existing scan',
    resolve: ({ scanId = '' }) => redirect(`${SCAN_VAULT_PATH.my}/${scanId}`),
    note: 'Adding files happens on the scan itself.',
  },
  {
    legacy: '/dashboard/scans/shared-scans',
    was: 'Shared Scans',
    resolve: () => redirect(SCAN_VAULT_PATH.shared),
    note: '',
  },
  {
    legacy: '/dashboard/scans/shared-scans/:scanId',
    was: 'a shared scan',
    resolve: ({ scanId = '' }) => redirect(`${SCAN_VAULT_PATH.shared}/${scanId}`),
    note: '',
  },
  {
    legacy: '/dashboard/scans/pending-scans',
    was: 'the group review queue',
    resolve: () => redirect(SCAN_VAULT_PATH.pending),
    note: '',
  },
  {
    legacy: '/dashboard/scans/pending-scans/:scanId',
    was: 'a queued group scan',
    resolve: ({ scanId = '' }) => redirect(`${SCAN_VAULT_PATH.pending}/${scanId}`),
    note: '',
  },
  {
    legacy: '/dashboard/scans/reviewed-scans',
    was: 'reviewed group scans',
    resolve: () => redirect(SCAN_VAULT_PATH.reviewed),
    note: '',
  },
  {
    legacy: '/dashboard/scans/reviewed-scans/:scanId',
    was: 'a reviewed group scan',
    resolve: ({ scanId = '' }) => redirect(`${SCAN_VAULT_PATH.reviewed}/${scanId}`),
    note: '',
  },
  {
    legacy: '/dashboard/scans/expert-scans',
    was: 'the expert review queue',
    resolve: () => redirect(SCAN_VAULT_PATH.expert),
    note: '',
  },
  {
    legacy: '/dashboard/scans/expert-scans/:scanId',
    was: 'a queued expert scan',
    resolve: ({ scanId = '' }) => redirect(`${SCAN_VAULT_PATH.expert}/${scanId}`),
    note: '',
  },
  {
    legacy: '/dashboard/scans/expert-reviewed-scans',
    was: 'reviewed expert scans',
    resolve: () => redirect(SCAN_VAULT_PATH['expert-reviewed']),
    note: '',
  },
  {
    legacy: '/dashboard/scans/expert-reviewed-scans/:scanId',
    was: 'a reviewed expert scan',
    resolve: ({ scanId = '' }) => redirect(`${SCAN_VAULT_PATH['expert-reviewed']}/${scanId}`),
    note: '',
  },
  {
    legacy: '/dashboard/scans/scan-vault',
    was: 'the "Scan Vault" file-library tab',
    resolve: () => redirect(SCAN_VAULT_PATH.my),
    note: 'Unreachable in the dashboard too: no menu entry pointed at it.',
  },
  {
    legacy: '/dashboard/dicom-upload',
    was: 'DICOM upload as a separate page (no menu entry)',
    resolve: () => redirect(CREATE_SCAN_PATH),
    note: 'DICOM files are accepted by the create-scan flow; a second upload page is not rebuilt.',
  },

  // ─── learning ───────────────────────────────────────────────────────────────
  {
    legacy: '/dashboard/my-courses',
    was: 'My Courses',
    resolve: () => redirect(SECTOR_PATH.courses),
    note: '',
  },
  {
    legacy: '/dashboard/my-courses/:courseId/list',
    was: 'a course outline',
    resolve: ({ courseId = '' }) => redirect(SECTOR_PATH.course(courseId)),
    note: '',
  },
  {
    legacy: '/dashboard/my-courses/:courseId',
    was: 'a course',
    resolve: ({ courseId = '' }) => redirect(SECTOR_PATH.course(courseId)),
    note: '',
  },
  {
    legacy: '/dashboard/my-courses/:courseId/lessons/:lessonId',
    was: 'a lesson',
    resolve: ({ courseId = '', lessonId = '' }) =>
      redirect(SECTOR_PATH.courseItem(courseId, lessonId)),
    note: 'One route serves every item; the server-resolved outline knows where the lesson sits.',
  },
  {
    legacy: '/dashboard/my-courses/:courseId/lessons/:lessonId/topics/:topicId',
    was: 'a topic',
    resolve: ({ courseId = '', topicId = '' }) =>
      redirect(SECTOR_PATH.courseItem(courseId, topicId)),
    note: '',
  },
  {
    legacy: '/dashboard/my-courses/:courseId/lessons/:lessonId/topics/:topicId/quizzes/:quizId',
    was: 'a quiz inside a topic',
    resolve: ({ courseId = '', quizId = '' }) => redirect(SECTOR_PATH.courseItem(courseId, quizId)),
    note: '',
  },
  {
    legacy: '/dashboard/my-courses/:courseId/lessons/:lessonId/quizzes/:quizId',
    was: 'a quiz inside a lesson',
    resolve: ({ courseId = '', quizId = '' }) => redirect(SECTOR_PATH.courseItem(courseId, quizId)),
    note: '',
  },
  {
    legacy: '/dashboard/my-courses/:courseId/quizzes/:quizId',
    was: 'a quiz at the course root',
    resolve: ({ courseId = '', quizId = '' }) => redirect(SECTOR_PATH.courseItem(courseId, quizId)),
    note: 'The fourth nesting shape, course > topic > quiz, had no route at all in the dashboard; here it is the same route as every other item.',
  },
  {
    legacy: '/dashboard/question-banks',
    was: 'Question Banks',
    resolve: () => redirect(SECTOR_PATH.questionBanks),
    note: '',
  },
  {
    legacy: '/dashboard/question-banks/:slug',
    was: 'a question bank',
    resolve: ({ slug = '' }) => redirect(SECTOR_PATH.questionBank(slug)),
    note: '',
  },
  {
    legacy: '/dashboard/pathology-gallery',
    was: 'the pathology gallery',
    resolve: () => redirect(SECTOR_PATH.gallery),
    note: '',
  },
  {
    legacy: '/dashboard/sage-ai',
    was: 'the Sage AI tutor frame',
    resolve: () => redirect(SECTOR_PATH.sage),
    note: '',
  },
  {
    legacy: '/dashboard/certificates',
    was: 'course certificates',
    resolve: () => retired('certificates', SECTOR_PATH.courses),
    note: 'CERTIFICATE_DOWNLOAD_MAINTENANCE is a hard-coded true; every row action returns null today.',
  },
  {
    legacy: '/certificates/:id',
    was: 'the certificate link in old completion emails',
    resolve: () => retired('certificates', SECTOR_PATH.courses),
    note: 'Never existed as a page; the dashboard already redirected it.',
  },

  // ─── groups ─────────────────────────────────────────────────────────────────
  {
    legacy: '/dashboard/manage-group',
    was: 'Groups (manage group)',
    resolve: () => redirect(SECTOR_PATH.groups),
    note: '',
  },
  {
    legacy: '/dashboard/manage-group/:groupId/learners',
    was: 'a group’s learners',
    resolve: ({ groupId = '' }) => redirect(SECTOR_PATH.groupMembers(groupId)),
    note: 'One members surface for every role; the columns follow the role.',
  },
  {
    legacy: '/dashboard/manage-group/:groupId/assignments',
    was: 'a group’s assignments',
    resolve: ({ groupId = '' }) => redirect(SECTOR_PATH.groupAssignments(groupId)),
    note: '',
  },
  {
    legacy: '/dashboard/manage-group-v1',
    was: 'the previous groups screen',
    resolve: () => redirect(SECTOR_PATH.groups),
    note: 'A dead route: no menu entry pointed at it.',
  },
  {
    legacy: '/dashboard/manage-group-v2',
    was: 'the other previous groups screen',
    resolve: () => redirect(SECTOR_PATH.groups),
    note: 'A dead route: no menu entry pointed at it.',
  },

  // ─── retired ────────────────────────────────────────────────────────────────
  {
    legacy: '/dashboard/orders',
    was: 'orders',
    resolve: () => retired('commerce', CREATE_SCAN_PATH),
    note: COMMERCE_NOTE,
  },
  {
    legacy: '/dashboard/payment-methods',
    was: 'payment methods',
    resolve: () => retired('commerce', CREATE_SCAN_PATH),
    note: COMMERCE_NOTE,
  },
  {
    legacy: '/dashboard/checkout',
    was: 'checkout',
    resolve: () => retired('commerce', CREATE_SCAN_PATH),
    note: 'The live checkout took a card number and did nothing: no order, no error, no navigation.',
  },
  {
    legacy: '/dashboard/thank-you',
    was: 'the post-checkout page',
    resolve: () => retired('commerce', CREATE_SCAN_PATH),
    note: COMMERCE_NOTE,
  },
  {
    legacy: '/store-listing/checkout',
    was: 'the storefront checkout',
    resolve: () => retired('commerce', CREATE_SCAN_PATH),
    note: COMMERCE_NOTE,
  },
  {
    legacy: '/store-listing/thank-you',
    was: 'the storefront thank-you page',
    resolve: () => retired('commerce', CREATE_SCAN_PATH),
    note: COMMERCE_NOTE,
  },
  {
    legacy: '/dashboard/referrals',
    was: 'referrals',
    resolve: () => retired('referrals', SECTOR_PATH.home),
    note: '0 referral documents against 3,152 users, and the route let any signed-in user read another user’s referral list with email addresses.',
  },
  {
    legacy: '/dashboard/fellowship',
    was: 'fellowship (v1)',
    resolve: () => retired('fellowship', SECTOR_PATH.courses),
    note: 'Frozen since 2 Jul 2025; superseded by 57 v2 endpoints no React calls; /api/schedule-slots, which this UI calls, is not mounted, so scheduling 404s.',
  },
  {
    legacy: '/dashboard/fellowship/mentee',
    was: 'the mentee view of fellowship (v1)',
    resolve: () => retired('fellowship', SECTOR_PATH.courses),
    note: 'See /dashboard/fellowship.',
  },
  {
    legacy: '/dashboard/knowledge-challenge',
    was: 'Rapid Review: knowledge challenge',
    resolve: () => retired('rapid-review', SECTOR_PATH.questionBanks),
    note: 'A sandboxed iframe onto a third-party Reflex app, flag off, identity asserted by an unsigned query string. Not GUSI code.',
  },
  {
    legacy: '/dashboard/interpretation-challenge',
    was: 'Rapid Review: interpretation challenge',
    resolve: () => retired('rapid-review', SECTOR_PATH.questionBanks),
    note: 'See /dashboard/knowledge-challenge.',
  },
  {
    legacy: '/dashboard/resources',
    was: 'resources',
    resolve: () => retired('resources', SECTOR_PATH.courses),
    note: 'A three-line ComingSoon stub with no menu entry and no inbound link.',
  },
  {
    legacy: '/dashboard/notifications',
    was: 'the in-app notification centre',
    resolve: () => retired('notifications', SECTOR_PATH.home),
    note: 'Four notification documents against 3,152 users; every notification that matters is an email the API already sends.',
  },
  {
    legacy: '/dashboard/notifications/:id',
    was: 'one in-app notification',
    resolve: () => retired('notifications', SECTOR_PATH.home),
    note: 'See /dashboard/notifications.',
  },
  {
    legacy: '/register',
    was: 'self-service registration',
    resolve: () => retired('registration', SECTOR_PATH.login),
    note: 'Accounts are minted by the WooCommerce webhook and by group invitations; the register flow ends in the same OTP mail the recovery flow uses.',
  },
  {
    legacy: '/register/verify',
    was: 'registration OTP',
    resolve: () => retired('registration', SECTOR_PATH.login),
    note: 'The second step of the registration flow retired with /register.',
  },
  {
    legacy: '/switch-user',
    was: 'administrator impersonation by token',
    resolve: () => retired('switch-user', SECTOR_PATH.login),
    note: 'Console-driven: the token is minted by POST /api/switch-user/generate-token from the internal console, which has not been ported.',
  },
];

/**
 * Compile a `:param` path into a matcher. Params match one segment; a
 * trailing slash on the incoming path is tolerated because the dashboard's
 * router tolerated it too.
 */
function compile(legacy: string): { pattern: RegExp; names: string[] } {
  const names: string[] = [];
  const source = legacy
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        names.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { pattern: new RegExp(`^${source}/?$`), names };
}

const COMPILED = LEGACY_ROUTES.map((route) => ({ route, ...compile(route.legacy) }));

/**
 * Where a legacy URL lands here.
 *
 * `unknown` for anything the dashboard did not route either — those go to
 * the ordinary 404, which is the honest answer for a URL nobody was ever
 * given.
 */
export function resolveLegacyPath(pathname: string): LegacyResolution {
  for (const { route, pattern, names } of COMPILED) {
    const match = pattern.exec(pathname);
    if (!match) continue;
    const params: Record<string, string> = {};
    names.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1] ?? '');
    });
    return route.resolve(params);
  }
  return { kind: 'unknown' };
}

/**
 * The legacy URL prefixes the router has to claim, so a bookmark to any of
 * them reaches `resolveLegacyPath` instead of the 404.
 */
export const LEGACY_ROOTS = [
  'dashboard',
  'certificates',
  'store-listing',
  'register',
  'switch-user',
] as const;
