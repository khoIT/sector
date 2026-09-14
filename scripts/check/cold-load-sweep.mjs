import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

/**
 * Open every route on a COLD load and say whether anything rendered.
 *
 *   node scripts/check/cold-load-sweep.mjs <jwt-secret> <fixture-dir>
 *
 * The test suites run in a node environment with no DOM, so no component is
 * ever rendered by them. A slice can pass lint, typecheck, every unit test,
 * the build and the fidelity replay and still be dead in a browser: the
 * question-bank runner shipped with its state initialised from an empty list
 * and its Start button did nothing on a first visit, which every gate missed
 * and one page load caught.
 *
 * Cold is the whole point. Each route gets a brand-new browser context, so
 * nothing is cached and the first paint is the one under test — the same bug
 * was invisible on a second visit because the query cache was warm.
 *
 * It asserts something weak on purpose: that the page rendered real text, and
 * that the console stayed quiet. A sweep that tried to assert content would
 * need updating with every copy change and would be switched off within a
 * month.
 *
 * `SECTOR_WEB_ORIGIN` / `SECTOR_API_ORIGIN` override the two hosts this talks
 * to (defaults `:3101` / `:5002`, the shared mirror instances) — set
 * `SECTOR_WEB_ORIGIN` when checking a worktree's own dev server on a
 * different port instead of the one every other phase shares, so this run
 * cannot be mistaken for a build nobody actually made.
 */

const WEB_ORIGIN = process.env.SECTOR_WEB_ORIGIN ?? 'http://localhost:3101';
const API_ORIGIN = process.env.SECTOR_API_ORIGIN ?? 'http://localhost:5002';

const [secret, fixtureDir] = process.argv.slice(2);
const HERE = fileURLToPath(new URL('.', import.meta.url));
const SP = fixtureDir ?? HERE;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function mint(userId) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ userId, iat: now, exp: now + 7200 });
  return `${h}.${p}.${createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
}
async function sessionFor(userId) {
  const token = mint(userId);
  const r = await fetch(`${API_ORIGIN}/api/account/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const u = (await r.json()).data;
  return {
    token,
    user: {
      id: u.id,
      email: u.email,
      userName: u.userName,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      role: {
        id: u.role.id,
        name: u.role.name,
        slug: u.role.slug ?? u.role.name,
        permissions: u.role.permissions,
      },
    },
  };
}

/**
 * `sweep-routes.json` ships beside this script, so the default run covers every
 * route the programme has built. `sweep-ids.json` cannot ship: it maps a role to
 * a user id, and the seeded accounts get fresh ids every time the local database
 * is rebuilt. Say so rather than failing with a bare ENOENT.
 */
function loadFixture(name) {
  // The fixture directory wins when it holds the file, so a caller can override
  // the routes; otherwise fall back to the copy shipped beside this script.
  for (const dir of [SP, HERE]) {
    try {
      return JSON.parse(readFileSync(`${dir}/${name}`, 'utf8'));
    } catch (cause) {
      if (cause.code !== 'ENOENT') throw cause;
    }
  }
  throw new Error(
    `${name} not found in ${SP} or ${HERE}.\n` +
      'Seed the local accounts with scripts/data/seed-test-accounts.ts, then write\n' +
      'sweep-ids.json as {"learner":"<id>","leader":"<id>","reviewer":"<id>",' +
      '"admin":"<id>"}\nin a fixture directory and pass that directory as the ' +
      'second argument.',
  );
}

const ids = loadFixture('sweep-ids.json');
const routes = loadFixture('sweep-routes.json');
const browser = await chromium.launch({ channel: 'chromium' });
const sessions = {};
for (const [role, id] of Object.entries(ids)) sessions[role] = await sessionFor(id);

const rows = [];
for (const { path, role, needs } of routes) {
  // A COLD load: a brand-new context every time, so nothing is cached and the
  // first paint is the one under test.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|404 \(Not Found\)/.test(m.text()))
      errors.push(m.text().slice(0, 120));
  });
  try {
    if (role) {
      await page.goto(`${WEB_ORIGIN}/login`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(
        (s) => localStorage.setItem('sector.session', JSON.stringify(s)),
        sessions[role],
      );
    }
    await page.goto(`${WEB_ORIGIN}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5500);
    const seen = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body;
      const text = (main.innerText || '').replace(/\s+/g, ' ').trim();
      return {
        chars: text.length,
        // `head` is for the report line. `needs` matches against the whole
        // page, because a route's distinguishing text is often well below the
        // first line — matching only the head is how four tabs that all
        // titled themselves "Members" passed this sweep.
        head: text.slice(0, 70),
        text,
        rows: document.querySelectorAll('table tbody tr').length,
        url: location.pathname,
      };
    });
    // A route that declares `needs` must show that text. There is deliberately
    // no escape hatch: an earlier version passed the route when the page
    // happened to render a table row, which let a page satisfy its own
    // assertion by rendering anything at all.
    const ok =
      seen.chars > 40 && errors.length === 0 && (!needs || new RegExp(needs, 'i').test(seen.text));
    rows.push({
      path,
      role: role ?? 'anon',
      landed: seen.url,
      chars: seen.chars,
      rows: seen.rows,
      ok,
      head: seen.head,
      errors: errors.slice(0, 2),
    });
  } catch (error) {
    rows.push({
      path,
      role: role ?? 'anon',
      ok: false,
      head: 'THREW: ' + String(error).slice(0, 90),
      errors,
    });
  }
  await context.close();
}
await browser.close();
for (const r of rows) {
  console.log(
    `${r.ok ? 'ok  ' : 'FAIL'} ${String(r.role).padEnd(9)} ${r.path.padEnd(42)} → ${String(r.landed ?? '').padEnd(40)} ${String(r.chars ?? 0).padStart(5)}ch ${String(r.rows ?? 0).padStart(3)}r  ${r.head}`,
  );
  if (r.errors?.length) r.errors.forEach((e) => console.log(`       ! ${e}`));
}
console.log(`\n${rows.filter((r) => r.ok).length}/${rows.length} routes healthy on a cold load`);
