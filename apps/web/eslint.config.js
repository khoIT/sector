import { scanvaultConfig } from '@scanvault/config/eslint';

export default [
  ...scanvaultConfig({ react: true }),
  {
    files: ['src/auth/auth-context.tsx'],
    rules: {
      // AuthProvider and useAuth are one unit. Splitting them to satisfy fast
      // refresh would only move the context object into a third file.
      'react-refresh/only-export-components': 'off',
    },
  },
];
