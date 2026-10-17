// @ts-check
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * ESM-only packages (and their ESM-only deps) that must be transformed for Jest.
 * The optional `.pnpm/<pkg>@<ver>/node_modules/` segment matches pnpm's virtual store.
 */
export const esmPackages = ['react-router', '@remix-run', 'cookie-es'];

/** @param {string[]} packages */
export function transformIgnorePatternFor(packages) {
  return `/node_modules/(?!(\\.pnpm/[^/]+/node_modules/)?(${packages.join('|')})/)`;
}

/** SWC options for @swc/jest (TS + TSX + ESM node_modules → CommonJS). */
export const swcOptions = {
  jsc: {
    target: 'es2022',
    parser: { syntax: 'typescript', tsx: true },
    transform: {
      react: { runtime: 'automatic' },
      // react-router reads import.meta.hot, which does not exist in CommonJS.
      optimizer: { globals: { vars: { 'import.meta.hot': 'undefined' } } },
    },
  },
  module: { type: 'commonjs' },
};

/**
 * Create a Jest config for a package or app.
 * Every tool path is resolved from this package, so consumers only need `jest`
 * itself (pnpm isolated layout, D7).
 *
 * @param {{
 *   rootDir: string,
 *   environment?: 'jsdom' | 'node',
 *   extraEsmPackages?: string[],
 *   setupFiles?: string[],
 *   overrides?: import('./index.d.ts').JestConfig,
 * }} options
 * @returns {import('./index.d.ts').JestConfig}
 */
export function createJestConfig({
  rootDir,
  environment = 'jsdom',
  extraEsmPackages = [],
  setupFiles = [],
  overrides = {},
}) {
  return {
    rootDir,
    testEnvironment:
      environment === 'jsdom'
        ? require.resolve('jest-environment-jsdom')
        : 'node',
    roots: ['<rootDir>/src'],
    setupFilesAfterEnv: [require.resolve('./setup.cjs'), ...setupFiles],
    watchman: false,
    // Nx runs several Jest processes in parallel; uncapped workers each (cores - 1) overload the
    // machine and tests time out. Override with `overrides: { maxWorkers }` or --maxWorkers.
    maxWorkers: '50%',
    testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
    moduleNameMapper: {
      '\\.(css|scss)$': require.resolve('identity-obj-proxy'),
      '^@/(.*)$': '<rootDir>/src/$1',
    },
    transform: {
      '^.+\\.(t|j)sx?$|^.+\\.mjs$': [require.resolve('@swc/jest'), swcOptions],
    },
    transformIgnorePatterns: [
      transformIgnorePatternFor([...esmPackages, ...extraEsmPackages]),
    ],
    ...overrides,
  };
}

export default createJestConfig;
