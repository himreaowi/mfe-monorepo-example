// @ts-check
import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Paths no package should lint. */
export const ignores = [
  // also nested build output, e.g. packages/webpack-config/test/fixture/dist written by its tests
  '**/dist/**',
  'build/**',
  'coverage/**',
  'node_modules/**',
  'playwright-report/**',
  'test-results/**',
  '.tmp-tests/**',
  '.blob/**',
];

/**
 * Nx module boundaries (D1/D5). Tags live in each package.json (`nx.tags`):
 * apps: `zone:intranet|internet`, `type:shell|remote`, `access:public|private`, `kind:external`;
 * packages/*: `type:package`; tools/*: `type:tool`.
 * tools/scripts check-apps is the backstop for what this rule cannot see.
 */
export const depConstraints = [
  // zones share nothing but packages/*
  { sourceTag: 'zone:intranet', notDependOnLibsWithTags: ['zone:internet'] },
  { sourceTag: 'zone:internet', notDependOnLibsWithTags: ['zone:intranet'] },
  // remotes never import remotes or shells; shells load remotes at runtime only
  {
    sourceTag: 'type:remote',
    onlyDependOnLibsWithTags: ['type:package', 'type:tool'],
  },
  {
    sourceTag: 'type:shell',
    onlyDependOnLibsWithTags: ['type:package', 'type:tool'],
  },
  // packages never depend on apps (or tools)
  { sourceTag: 'type:package', onlyDependOnLibsWithTags: ['type:package'] },
  {
    sourceTag: 'type:tool',
    onlyDependOnLibsWithTags: ['type:package', 'type:tool'],
  },
];

/**
 * App package names (`@org/<zone>-<name>`, `@org/shell-<zone>`, set by the generators). No code
 * imports an app. The Nx rule maps a package import to a project only when the package declares
 * `exports`/`main` (apps do not), so app imports by package name are blocked here by name.
 * Relative imports into another project are caught by the Nx rule; dynamic imports and
 * package.json dependencies by tools/scripts check-apps.
 */
export const appImportPatterns = [
  '@org/intranet-*',
  '@org/internet-*',
  '@org/shell-*',
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
      '@nx': nx,
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
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: appImportPatterns,
              message:
                'Apps are never imported (shells load remotes at runtime, remotes never import remotes or shells, zones share only packages/*). Move shared code to packages/. See docs/guardrails.md.',
            },
          ],
        },
      ],
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: false,
          allow: [],
          depConstraints,
        },
      ],
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
