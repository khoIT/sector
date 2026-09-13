import { LEGACY_ROUTES } from './legacy-route-map';

/**
 * The decommission document's tables, rendered from the route map so the
 * prose in docs/ can never claim a destination the router does not have.
 * The prose around the tables (order of switch-off, rollback) is written in
 * the document itself, above the generated marker.
 */

const REASON_TITLE: Record<string, string> = {
  commerce: 'Commerce',
  certificates: 'Certificates',
  fellowship: 'Fellowship v1',
  'rapid-review': 'Rapid Review',
  referrals: 'Referrals',
  resources: 'Resources',
  notifications: 'In-app notifications',
  registration: 'Self-service registration',
  'switch-user': 'Switch user',
};

function code(value: string): string {
  return `\`${value}\``;
}

export function renderDecommissionDocument(): string {
  const redirects = LEGACY_ROUTES.filter((route) => route.resolve({}).kind === 'redirect');
  const retired = LEGACY_ROUTES.filter((route) => route.resolve({}).kind === 'retired');

  const lines: string[] = [];
  lines.push('# Decommissioning the dashboard');
  lines.push('');
  lines.push(
    'Every URL `gusi_web_dashboard` served, and what Sector does with it. Generated from',
    '`apps/web/src/app/legacy-route-map.ts` by `pnpm docs:legacy-routes`;',
    'a test fails when this file and that table disagree. The router mounts the same table, so a',
    'legacy bookmark, an emailed scan link or a saved tab lands where the rows below say.',
  );
  lines.push('');
  lines.push('## Kept at the same path');
  lines.push('');
  lines.push(
    '`/login`, `/forgot-password`, `/forgot-password/verify`, `/forgot-password/reset` and',
    '`/group-invitation-confirmation` are served by Sector at the paths the dashboard used, because',
    "the API's own emails link to them.",
  );
  lines.push('');
  lines.push(`## Forwarded (${redirects.length})`);
  lines.push('');
  lines.push('| Dashboard | Was | Sector | Note |');
  lines.push('| --- | --- | --- | --- |');
  for (const route of redirects) {
    const sample = Object.fromEntries(
      [...route.legacy.matchAll(/:([a-zA-Z]+)/g)].map((match) => [
        match[1] as string,
        `:${match[1]}`,
      ]),
    );
    const resolution = route.resolve(sample);
    const to = resolution.kind === 'redirect' ? resolution.to : '';
    lines.push(`| ${code(route.legacy)} | ${route.was} | ${code(to)} | ${route.note} |`);
  }
  lines.push('');
  lines.push(`## Retired (${retired.length})`);
  lines.push('');
  lines.push(
    'A bookmark to any of these lands on a page that names the reason and links to the nearest',
    'surface that works. The evidence for each decision is the note.',
  );
  lines.push('');
  lines.push('| Dashboard | Was | Reason | Sends to | Evidence |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const route of retired) {
    const resolution = route.resolve({});
    if (resolution.kind !== 'retired') continue;
    lines.push(
      `| ${code(route.legacy)} | ${route.was} | ${REASON_TITLE[resolution.reason] ?? resolution.reason} | ${code(resolution.alternative)} | ${route.note} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}
