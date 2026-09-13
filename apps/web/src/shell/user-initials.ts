import type { AuthUser } from '@sector/api-client';

/**
 * Two letters standing in for a face.
 *
 * This is the control, not a fallback: `photo` is empty on all 3,151 users in
 * the database, so every avatar in the app today is initials. The `<img>`
 * branch stays in the component because the field is on the wire and the
 * profile page adds the upload that fills it.
 *
 * 2,985 of 3,151 users have a first name; all 3,151 have a username, so the
 * username is the second source rather than a last resort.
 */

type InitialsInput = Pick<AuthUser, 'firstName' | 'lastName' | 'userName'>;

/**
 * Letters and digits only, upper-cased.
 *
 * A name can lead with punctuation or a stray quote, and a username can be
 * `sv_learner`; stripping first means `'Brien` initials as B rather than as an
 * apostrophe, and `sv_learner` as SV rather than SV_ truncated mid-separator.
 */
function alphanumeric(value: string | null | undefined): string {
  return [...(value ?? '')]
    .filter((character) => /[\p{L}\p{N}]/u.test(character))
    .join('')
    .toUpperCase();
}

export function initialsFor(user: InitialsInput | null | undefined): string {
  if (!user) return '?';

  const first = alphanumeric(user.firstName);
  const last = alphanumeric(user.lastName);
  if (first && last) return first.charAt(0) + last.charAt(0);

  // One name only: take two letters from it rather than rendering a lone
  // character in a circle sized for two.
  const single = first || last;
  if (single) return single.slice(0, 2);

  return alphanumeric(user.userName).slice(0, 2) || '?';
}

/**
 * The server's stand-in avatar, which is not a photo of anyone.
 *
 * `photo` is empty on all 3,151 user documents, but the API never returns that:
 * `getUserPhoto` substitutes `DEFAULT_USER_PHOTO` — `images/user.png`, a grey
 * silhouette — and hands back a presigned URL for it. So every account in the
 * app renders the same anonymous icon, and the initials branch that was meant
 * to distinguish accounts never runs.
 *
 * Initials beat one silhouette shared by every user, which is the whole point
 * of putting identity in the header. Treat the default as absent.
 *
 * Matched on the key, not the whole URL: the presigned query string carries a
 * signature and an expiry that change on every request.
 */
const DEFAULT_PHOTO_KEY = '/images/user.png';

export function isDefaultPhoto(photo: string | null | undefined): boolean {
  const url = (photo ?? '').trim();
  if (!url) return true;

  // Strip the query before matching so the signature cannot hide the key, and
  // fall back to the raw string for a value that is not a parseable URL.
  const path = url.split('?')[0] ?? url;
  return path.endsWith(DEFAULT_PHOTO_KEY);
}

/** The photo worth rendering, or null when it is the shared placeholder. */
export function realPhotoUrl(photo: string | null | undefined): string | null {
  return isDefaultPhoto(photo) ? null : (photo ?? null);
}

/** The name to print beside the avatar, never blank. */
export function accountDisplayName(user: InitialsInput | null | undefined): string {
  if (!user) return 'Account';
  const full = [user.firstName, user.lastName]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return full || (user.userName ?? '').trim() || 'Account';
}

/**
 * Role names arrive lower-cased from the server — `subscriber`, `scan
 * reviewer`, `group leader` — except `Superadmin`, which does not. Title-case
 * every word so the menu reads consistently whichever one it gets.
 */
export function roleLabel(roleName: string | null | undefined): string {
  const trimmed = (roleName ?? '').trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
