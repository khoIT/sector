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
 *
 * Every route is also loaded at a phone width and a wide-desktop width, and a
 * route whose document scrolls sideways fails. A page that has to be dragged
 * left and right on a phone is broken whatever its text says, and no unit test
 * can see it: both suites run in a node environment where nothing has a
 * layout. `SECTOR_SWEEP_WIDTHS` (default `390,1440,2200`) sets the widths and
 * `SECTOR_SWEEP_PRIMARY` (default `1440`) picks which one does the expensive
 * settle — the others load, settle briefly and get measured, which is what
 * keeps a three-width run affordable.
 */

const WEB_ORIGIN = process.env.SECTOR_WEB_ORIGIN ?? 'http://localhost:3101';
const API_ORIGIN = process.env.SECTOR_API_ORIGIN ?? 'http://localhost:5002';
const WIDTHS = (process.env.SECTOR_SWEEP_WIDTHS ?? '390,1440,2200')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
const PRIMARY = Number(process.env.SECTOR_SWEEP_PRIMARY ?? 1440);

// A gate that passes because it was misconfigured is worse than no gate. Every
// one of these used to end in "0/0 routes healthy" and exit 0: a width list
// that parsed to nothing, a primary that is not a number, or a primary that is
// simply not in the list -- in which case the loop below never takes the
// branch that records a row, and `rows.some(...)` is vacuously false.
if (WIDTHS.length === 0) {
  console.error('SECTOR_SWEEP_WIDTHS parsed to no usable width; refusing to report a clean sweep.');
  process.exit(2);
}
if (!Number.isFinite(PRIMARY) || PRIMARY <= 0) {
  console.error(`SECTOR_SWEEP_PRIMARY is not a width: ${process.env.SECTOR_SWEEP_PRIMARY}`);
  process.exit(2);
}
if (!WIDTHS.includes(PRIMARY)) WIDTHS.push(PRIMARY);
WIDTHS.sort((a, b) => a - b);

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

/**
 * The widest elements sticking out past the viewport, for the failure line.
 *
 * Reported rather than merely counted: "the document is 966px too wide" is a
 * symptom, and the element that causes it is the fix.
 *
 * Elements inside a scroll container are skipped, and that exclusion is the
 * whole value of this function. A wide table inside its own `overflow-x-auto`
 * is a deliberate design that moves nothing; listing it sends the reader to
 * rewrite a table that was innocent. The real culprit of the 966px drag was an
 * absolutely positioned `sr-only` label whose containing block was three
 * components away — visible here, invisible in the markup.
 */
async function overflowCulprits(page) {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    // A transform, a filter, a perspective or paint containment makes even a
    // `static` element the containing block for positioned descendants. Asking
    // only about `position` is how a scroller that genuinely clips its content
    // gets reported as letting it escape -- `contain: paint` is one of the two
    // ways to fix the very bug this function exists to find.
    const establishesForFixed = (style) =>
      style.transform !== 'none' ||
      style.filter !== 'none' ||
      style.backdropFilter !== 'none' ||
      style.perspective !== 'none' ||
      /transform|filter|perspective/.test(style.willChange) ||
      /paint|layout|strict|content/.test(style.contain);

    const containingBlockOf = (el, position) => {
      if (position !== 'absolute' && position !== 'fixed') return null;
      for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        const establishes =
          position === 'absolute'
            ? style.position !== 'static' || establishesForFixed(style)
            : establishesForFixed(style);
        if (establishes) return ancestor;
      }
      return null;
    };

    const clipped = (el) => {
      const position = getComputedStyle(el).position;
      const inFlow = position !== 'absolute' && position !== 'fixed';
      // Where this element's geometry is actually resolved. Null means the
      // initial containing block -- the viewport -- so nothing in the document
      // can clip it.
      const containingBlock = containingBlockOf(el, position);
      if (!inFlow && !containingBlock) return false;

      for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const overflow = getComputedStyle(ancestor).overflowX;
        if (overflow !== 'auto' && overflow !== 'scroll' && overflow !== 'hidden') continue;
        // An in-flow element is clipped by any scrolling ancestor. A positioned
        // one is clipped only by a scroller at or above its containing block:
        // a scroller BETWEEN the element and its containing block is exactly
        // what it escapes, which is the whole shape of the bug.
        if (inFlow || ancestor.contains(containingBlock)) return true;
      }
      return false;
    };

    const over = [...document.querySelectorAll('*')]
      .map((el) => ({ el, right: Math.round(el.getBoundingClientRect().right) }))
      .filter((entry) => entry.right > limit + 1 && !clipped(entry.el))
      .sort((a, b) => b.right - a.right);

    return over
      .filter((entry) => !over.some((other) => other !== entry && entry.el.contains(other.el)))
      .slice(0, 3)
      .map(({ el, right }) => {
        const cls = typeof el.className === 'string' ? el.className.slice(0, 60) : '';
        const position = getComputedStyle(el).position;
        return `${el.tagName.toLowerCase()}${cls ? `.${cls.trim().split(/\s+/).join('.')}` : ''} [${position}] → ${right}px`;
      });
  });
}

const rows = [];
const overflows = [];
for (const { path, role, needs } of routes) {
  for (const width of WIDTHS) {
    const primary = width === PRIMARY;
    // A COLD load: a brand-new context every time, so nothing is cached and the
    // first paint is the one under test.
    const context = await browser.newContext({ viewport: { width, height: 900 } });
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

      // Wait for the page to actually settle rather than for a stopwatch. A flat
      // timeout has to be long enough for the slowest route on the busiest
      // machine, or it reports a route as broken when it was only slow — which
      // is exactly what a fixed 5.5s did to the course runner under load. This
      // returns as soon as the text stops growing, so quick routes stay quick.
      //
      // Stable text is NOT the same as a finished page. A panel showing a
      // loading placeholder has stable text for as long as it is loading, so a
      // route whose header satisfies `needs` could settle and pass while the
      // panel under it had never rendered — which is exactly how a lesson page
      // reported healthy for a whole phase with its body still on a skeleton.
      // So a placeholder on screen means not settled, and not healthy either.
      //
      // Only the primary width pays for that. The other widths are measuring
      // geometry, and geometry is settled long before the last panel resolves;
      // making all three widths wait the full settle is what would turn this
      // into a sweep nobody runs.
      const read = () =>
        page.evaluate(() => ({
          text: ((document.querySelector('main') ?? document.body).innerText || '')
            .replace(/\s+/g, ' ')
            .trim(),
          pending: document.querySelectorAll('.sv-skeleton').length,
        }));
      let settled = '';
      let last = { text: '', pending: 0 };
      for (let i = 0; i < (primary ? 24 : 8); i += 1) {
        await page.waitForTimeout(1000);
        const now = await read();
        last = now;
        // `pending === 0` is required at EVERY width, not just the primary one.
        // Skeletons carry no text, so a page still showing them has text that
        // is stable and short -- which reads as settled to a text-only check.
        // They are also `w-full`, so they never overflow: measuring then is how
        // a route whose table had not rendered reports that it fits.
        const ready =
          now.text.length > 40 &&
          now.pending === 0 &&
          now.text === settled &&
          (!primary || !needs || new RegExp(needs, 'i').test(now.text));
        settled = now.text;
        if (ready) break;
      }

      // The geometry question, asked at every width: does this page make the
      // reader drag it sideways? `scrollWidth > clientWidth` on the document is
      // the only honest form of it — an inner scroller (a wide table in its own
      // `overflow-x-auto`) is a deliberate design and does not move the
      // document, so it does not trip this.
      const box = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      if (box.scrollWidth > box.clientWidth + 1) {
        overflows.push({
          path,
          role: role ?? 'anon',
          width,
          by: box.scrollWidth - box.clientWidth,
          pending: last.pending,
          culprits: await overflowCulprits(page),
        });
      }

      if (primary) {
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
            pending: document.querySelectorAll('.sv-skeleton').length,
            url: location.pathname,
          };
        });
        // A route that declares `needs` must show that text. There is deliberately
        // no escape hatch: an earlier version passed the route when the page
        // happened to render a table row, which let a page satisfy its own
        // assertion by rendering anything at all.
        const ok =
          seen.chars > 40 &&
          seen.pending === 0 &&
          errors.length === 0 &&
          (!needs || new RegExp(needs, 'i').test(seen.text));
        rows.push({
          path,
          role: role ?? 'anon',
          landed: seen.url,
          chars: seen.chars,
          rows: seen.rows,
          pending: seen.pending,
          ok,
          head: seen.head,
          errors: errors.slice(0, 2),
        });
      }
    } catch (error) {
      if (primary) {
        rows.push({
          path,
          role: role ?? 'anon',
          ok: false,
          head: 'THREW: ' + String(error).slice(0, 90),
          errors,
        });
      } else {
        overflows.push({
          path,
          role: role ?? 'anon',
          width,
          threw: String(error).slice(0, 90),
        });
      }
    }
    await context.close();
  }
}
await browser.close();

for (const r of rows) {
  console.log(
    `${r.ok ? 'ok  ' : 'FAIL'} ${String(r.role).padEnd(9)} ${r.path.padEnd(42)} → ${String(r.landed ?? '').padEnd(40)} ${String(r.chars ?? 0).padStart(5)}ch ${String(r.rows ?? 0).padStart(3)}r  ${r.head}`,
  );
  if (r.pending) console.log(`       ! still loading: ${r.pending} placeholder(s) on screen`);
  if (r.errors?.length) r.errors.forEach((e) => console.log(`       ! ${e}`));
}
console.log(
  `\n${rows.filter((r) => r.ok).length}/${rows.length} routes healthy on a cold load at ${PRIMARY}px`,
);

console.log(`\nHorizontal overflow, widths ${WIDTHS.join(' / ')}px:`);
if (overflows.length === 0) {
  console.log(`  none — every route fits its viewport at all ${WIDTHS.length} widths`);
} else {
  for (const o of overflows) {
    console.log(
      `  FAIL ${String(o.width).padStart(4)}px ${String(o.role).padEnd(9)} ${o.path.padEnd(42)} ${o.threw ? o.threw : `+${o.by}px`}`,
    );
    // A page still showing placeholders has not laid out its real content, so
    // whatever this measured is not the finished page -- in either direction.
    if (o.pending)
      console.log(`         ↳ measured with ${o.pending} placeholder(s) on screen — unproven`);
    o.culprits?.forEach((c) => console.log(`         ↳ ${c}`));
  }
}
console.log(`${overflows.length} overflow finding(s) across ${routes.length} routes`);

// A sweep that reports and exits 0 is a sweep a pipeline ignores -- and one
// that reports on fewer routes than it was given has skipped something without
// saying so, which is the same failure wearing a clean face.
const missing = routes.length - rows.length;
if (missing !== 0) {
  console.log(`\nMISSING: ${missing} route(s) produced no result at ${PRIMARY}px`);
}
process.exitCode = missing !== 0 || rows.some((r) => !r.ok) || overflows.length > 0 ? 1 : 0;
