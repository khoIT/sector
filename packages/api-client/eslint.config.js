import { scanvaultConfig } from '@scanvault/config/eslint';

export default [
  ...scanvaultConfig({ react: true }),
  {
    files: ['**/*.tsx'],
    rules: {
      // This package is a library, not an HMR boundary: ApiClientProvider and
      // useApiClient belong in the same file.
      'react-refresh/only-export-components': 'off',
    },
  },
];
