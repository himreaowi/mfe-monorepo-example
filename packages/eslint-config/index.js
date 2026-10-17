// @ts-check
import js from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Paths no package should lint. */
export const ignores = [
  'dist/**',
  'build/**',
  'coverage/**',
  'node_modules/**',
  'playwright-report/**',
  'test-results/**',
  '.tmp-tests/**',
  '.blob/**',
];

/**
 * Shared flat config for every app and package (ported from starter-mfe).
 * Usage in a package's eslint.config.js:
 *   import config from '@org/eslint-config';
 *   export default config;
 * or extend: export default [...config, { rules: { ... } }];
 */
const config = tseslint.config(
  { ignores },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Classic React Hooks rules (React Compiler-only rules are not enabled).
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  eslintPluginPrettierRecommended,
);

export default config;
