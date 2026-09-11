/**
 * The Scan Vault list surface.
 *
 * The router mounts the pages directly (see src/app/scan-vault-routes.tsx),
 * so this barrel exists for the things OTHER features read: the one table of
 * Scan Vault paths, titles and permissions, and the tab-visibility rules the
 * shell's sidebar shares with the in-page tab set.
 */
export {
  CREATE_SCAN_PATH,
  isReviewedList,
  isReviewQueue,
  isScanListView,
  SCAN_VAULT_PATH,
  SCAN_VAULT_PERMISSION,
  SCAN_VAULT_ROOT,
  SCAN_VAULT_TITLE,
  type ScanVaultView,
} from './scan-list-views';

export { canOpenView, visibleScanTabs, visibleScanViews } from './tabs/scan-tab-model';
export { readLastTab } from './tabs/last-tab-store';

export { MyScansPage } from './pages/my-scans-page';
export { ScanListPage } from './pages/scan-list-page';
export { SharedScansPage } from './pages/shared-scans-page';
