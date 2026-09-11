import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * Shared ESLint flat config for every ScanVault workspace package.
 *
 * Usage in a package's `eslint.config.js`:
 *
 *   import { scanvaultConfig } from '@scanvault/config/eslint';
 *   export default scanvaultConfig({ react: true });
 *
 * @param {{ react?: boolean, ignores?: string[] }} [options]
 * @returns {import('eslint').Linter.Config[]}
 */
export function scanvaultConfig(options = {}) {
  const { react = false, ignores = [] } = options;

  /** @type {import('eslint').Linter.Config[]} */
  const config = [
    { ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.turbo/**', ...ignores] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        ecmaVersion: 2023,
        globals: { ...globals.browser, ...globals.node },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        eqeqeq: ['error', 'smart'],
      },
    },
  ];

  if (react) {
    config.push({
      files: ['**/*.{ts,tsx}'],
      plugins: {
        'react-hooks': reactHooks,
        'react-refresh': reactRefresh,
      },
      rules: {
        ...reactHooks.configs.recommended.rules,
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      },
    });
  }

  return config;
}

export default scanvaultConfig();
