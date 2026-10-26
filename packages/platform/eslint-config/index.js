// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Paths no package should lint. */
export const ignores = [
  // also nested build output, e.g. packages/platform/webpack-config/test/fixture/dist written by its tests
  '**/dist/**',
  'build/**',
  'coverage/**',
  'node_modules/**',
  'playwright-report/**',
  'test-results/**',
  '.tmp-tests/**',
  '.blob/**',
  // Storybook static build of @org/ui (pnpm build-storybook)
  '**/storybook-static/**',
];

/**
 * Nx module boundaries (D1/D5), the import table of docs/where-code-goes.md. Tags live in each
 * package.json (`nx.tags`) and follow the folder (tools/scripts check-packages `layerTags`):
 * apps: `zone:intranet|internet`, `type:shell|remote`, `access:public|private`, `kind:external`;
 * apps/<zone>/libs/*: `zone:<zone>`, `type:lib`; packages/common/*: `type:common`;
 * packages/platform/*: `type:package`; tools/*: `type:tool`.
 * tools/scripts check-packages (package-boundaries) and check-apps are the backstop for what this
 * rule cannot see (package.json dependencies, dynamic imports); a test there keeps both in sync.
 */
export const depConstraints = [
  // zones share nothing but packages/common and packages/platform
  { sourceTag: 'zone:intranet', notDependOnLibsWithTags: ['zone:internet'] },
  { sourceTag: 'zone:internet', notDependOnLibsWithTags: ['zone:intranet'] },
  // remotes never import remotes or shells; shells load remotes at runtime only
  {
    sourceTag: 'type:remote',
    onlyDependOnLibsWithTags: [
      'type:lib',
      'type:common',
      'type:package',
      'type:tool',
    ],
  },
  {
    sourceTag: 'type:shell',
    onlyDependOnLibsWithTags: [
      'type:lib',
      'type:common',
      'type:package',
      'type:tool',
    ],
  },
  // zone libraries: other libraries of the zone, common, platform (never apps)
  {
    sourceTag: 'type:lib',
    onlyDependOnLibsWithTags: ['type:lib', 'type:common', 'type:package'],
  },
  // common ships to both zones (and the public internet portals): never zone code
  {
    sourceTag: 'type:common',
    onlyDependOnLibsWithTags: ['type:common', 'type:package'],
  },
  // platform packages never depend on business code, apps or tools
  { sourceTag: 'type:package', onlyDependOnLibsWithTags: ['type:package'] },
  {
    sourceTag: 'type:tool',
    onlyDependOnLibsWithTags: ['type:package', 'type:tool'],
  },
];

/** Used when no workspace root is found (e.g. linting a copy of a package on its own). */
const FALLBACK_APP_PATTERNS = ['@org/shell-*'];

/**
 * The workspace root: the nearest folder (from `start` upwards) with a pnpm-workspace.yaml.
 * @param {string} [start]
 * @returns {string | undefined}
 */
export function findWorkspaceRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Package names of every app (apps/<zone>/<portal>/<folder>), not of the zone libraries in
 * apps/<zone>/libs/ (those are imported by name).
 * @param {string} root
 * @returns {string[]}
 */
export function appPackageNames(root) {
  return fs
    .globSync('apps/*/*/*/package.json', {
      cwd: root,
      exclude: ['**/node_modules/**', 'apps/*/libs/**'],
    })
    .map((file) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')).name;
      } catch {
        return undefined;
      }
    })
    .filter((name) => typeof name === 'string')
    .sort();
}

/**
 * Import patterns of the apps (`@org/<zone>-<name>`, `@org/shell-<portal>`, set by the
 * generators). No code imports an app. The Nx rule maps a package import to a project only when
 * the package declares `exports`/`main` (apps do not), so app imports by package name are
 * blocked here by name. The names are read from the workspace because a zone library shares the
 * `@org/<zone>-` prefix and is imported by name. Relative imports into another project are
 * caught by the Nx rule; dynamic imports and package.json dependencies by tools/scripts.
 */
const workspaceRoot = findWorkspaceRoot();
export const appImportPatterns = workspaceRoot
  ? appPackageNames(workspaceRoot).flatMap((name) => [name, `${name}/*`])
  : FALLBACK_APP_PATTERNS;

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
          patterns:
            appImportPatterns.length === 0
              ? []
              : [
                  {
                    group: appImportPatterns,
                    message:
                      'Apps are never imported (shells load remotes at runtime, remotes never import remotes or shells, libraries never import apps). Move shared code to apps/<zone>/libs/<capability> (one zone) or packages/common/<capability> (both zones, public). See docs/where-code-goes.md.',
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
