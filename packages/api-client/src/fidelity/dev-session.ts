import { createHmac } from 'node:crypto';

/**
 * A bearer token for the LOCAL mirror API, signed with the secret that
 * instance was started with.
 *
 * The API verifies `{ userId }` claims with HS256 (utils/jwt-handler.ts), so a
 * token minted here is indistinguishable from one it issued — which is the
 * point: the route replay signs in as any account the mirror holds without a
 * password, and without spending the 20-per-15-minutes auth budget the
 * developer's own browser shares. It is only ever as useful as the secret,
 * which lives in the shell that started the :5002 process and nowhere else; a
 * deployed API has a different secret and this mints nothing it will accept.
 */
export function mintDevSession(userId: string, secret: string, ttlSeconds = 2 * 60 * 60): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode({ userId, iat: now, exp: now + ttlSeconds });
  const signature = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}
