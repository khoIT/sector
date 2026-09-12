import { scanvaultConfig } from '@scanvault/config/eslint';

export default [
  ...scanvaultConfig({ react: true }),
  {
    // Build-time tooling, run by node rather than shipped to a browser.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    files: ['src/auth/auth-context.tsx'],
    rules: {
      // AuthProvider and useAuth are one unit. Splitting them to satisfy fast
      // refresh would only move the context object into a third file.
      'react-refresh/only-export-components': 'off',
    },
  },
];
