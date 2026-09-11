import { ScanListPage } from './scan-list-page';

/**
 * My Scans.
 *
 * A named module of its own because it is the one tab the router loads for
 * every user, and the one whose empty state is a whole surface rather than a
 * row of placeholder text.
 */
export function MyScansPage() {
  return <ScanListPage view="my" />;
}
