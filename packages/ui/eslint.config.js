import { scanvaultConfig } from '@scanvault/config/eslint';

export default [
  ...scanvaultConfig({ react: true }),
  {
    files: ['**/*.tsx'],
    rules: {
      // This package is a library, not an HMR boundary. Co-locating a hook or
      // a cva variant map with its component is the intended shape here.
      'react-refresh/only-export-components': 'off',
    },
  },
];
