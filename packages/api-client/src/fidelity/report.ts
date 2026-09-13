import type { ReplayResult, ShapeFailure } from './replay';

/**
 * The replay as text: one row per entry, then the failing shapes.
 *
 * Counts and a sample id per shape, never a document body — the mirror holds
 * real people's names and email addresses, and a test log is the last place
 * they should end up.
 */

function rate(result: ReplayResult): string {
  if (result.total === 0) return '   —  ';
  const pct = (result.parsed / result.total) * 100;
  return `${pct.toFixed(pct === 100 || pct < 99.995 ? 2 : 3).padStart(6)}%`;
}

function formatShape(shape: ShapeFailure, indent = '    '): string {
  const first = shape.sampleIssues[0];
  const message = first ? `${first.path.join('.') || '<root>'}: ${first.message}` : '';
  return [
    `${indent}${String(shape.count).padStart(7)}  ${shape.signature}`,
    `${indent}         sample _id ${shape.sampleId}${message ? `  — ${message}` : ''}`,
  ].join('\n');
}

export function formatReplayReport(results: ReplayResult[]): string {
  const lines: string[] = [];
  const width = Math.max(24, ...results.map((result) => result.name.length));

  lines.push('');
  lines.push(
    `${'entry'.padEnd(width)}  ${'total'.padStart(7)}  ${'parsed'.padStart(7)}     rate     time`,
  );
  for (const result of results) {
    const skipped = result.skipped ? `  (${result.skipped} the route would drop)` : '';
    lines.push(
      `${result.name.padEnd(width)}  ${String(result.total).padStart(7)}  ${String(result.parsed).padStart(7)}  ${rate(result)}  ${(result.durationMs / 1000).toFixed(1).padStart(6)}s${skipped}`,
    );
  }

  const failing = results.filter((result) => result.shapes.length > 0);
  if (failing.length > 0) {
    lines.push('');
    lines.push('shapes the schema did not accept:');
    for (const result of failing) {
      lines.push(`  ${result.name}`);
      for (const shape of result.shapes) lines.push(formatShape(shape));
    }
  }
  lines.push('');
  return lines.join('\n');
}
