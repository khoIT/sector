import { ApiClientProvider } from '@sector/api-client';
import { ThemeProvider } from '@sector/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { RouterProvider } from 'react-router-dom';

import { AuthProvider } from '@/auth/auth-context';
import { apiClient } from '@/lib/api';

import { createQueryClient } from './query-client';
import { router } from './router';

/**
 * Provider order matters:
 *   ThemeProvider       stamps data-theme before anything paints
 *   QueryClientProvider AuthProvider's login/restore hooks need it
 *   ApiClientProvider   every api-client hook resolves the client from here
 *   AuthProvider        registers the 401 handler and owns the session
 *   RouterProvider      the guards read auth status, so it comes last
 *
 * nuqs's adapter is NOT here: it needs router context, so it is mounted inside
 * <AppShell/>.
 */
export function App() {
  const [queryClient] = useState(createQueryClient);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider client={apiClient}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ApiClientProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
