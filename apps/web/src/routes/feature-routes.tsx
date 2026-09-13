import type { RouteObject } from 'react-router-dom';

import { accountRoutes } from '@/features/account/account-routes';
import { assignmentsRoutes } from '@/features/assignments/assignments-routes';
import { coursesRoutes } from '@/features/courses/courses-routes';
import { createScanRoutes } from '@/features/create-scan/create-scan-routes';
import { galleryRoutes } from '@/features/gallery/gallery-routes';
import { groupsRoutes } from '@/features/groups/groups-routes';
import { questionBankRoutes } from '@/features/question-banks/question-bank-routes';
import { sageRoutes } from '@/features/sage/sage-routes';
import { scanDetailRoutes } from '@/features/scan-detail';

import { unbuiltSurfaceRoutes } from './unbuilt-surface-routes';

/**
 * EXTENSION POINT — the only file feature agents edit to add routes.
 *
 * Every entry here is mounted as a CHILD of <AppShell/>, which is itself
 * behind <RequireAuth/>. So:
 *   - paths are relative to '/' (write 'scans/create', not '/scans/create')
 *   - a session is guaranteed; useAuth().user is non-null
 *   - the shell's <Outlet/> is where your element renders
 *
 * Add a permission gate with <RequirePermission required="view:scan:pending"/>
 * as a pathless layout route rather than checking permissions inline.
 *
 * The six Scan Vault TAB paths are NOT here — they live in
 * src/app/scan-vault-routes.tsx, which is mounted just before this array.
 *
 * Keep this array flat and one import per feature area so four agents editing
 * it in parallel produce small, separable diffs.
 */
export const featureRoutes: RouteObject[] = [
  ...scanDetailRoutes,
  ...createScanRoutes,
  ...accountRoutes,
  // Question banks, groups administration and courses: real pages behind
  // what used to be three rows in ./unbuilt-surfaces.ts, each mounted at the
  // same path the rail always pointed at.
  ...questionBankRoutes,
  ...groupsRoutes,
  ...coursesRoutes,
  ...galleryRoutes,
  ...sageRoutes,
  ...assignmentsRoutes,
  // Whatever is left in Learn/Administer with no surface yet resolves to the
  // same honest placeholder until a feature replaces its row in
  // ./unbuilt-surfaces.ts.
  ...unbuiltSurfaceRoutes,
];
