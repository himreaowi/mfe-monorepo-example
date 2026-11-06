// @ts-check
/**
 * D4 tier 1: core singletons. One version for everyone (default catalog / workspace), shared
 * by Module Federation as `singleton + strictVersion`. Must equal TIER1_SINGLETONS in
 * @org/webpack-config (check-versions verifies). Anything holding cross-app React context or
 * state (router, query cache, i18n, global store) belongs here, and so does a library every app
 * would otherwise download again (axios).
 */
export const TIER1 = [
  'react',
  'react-dom',
  'react-router',
  '@org/ui',
  '@org/auth',
  '@tanstack/react-query',
  'axios',
];
