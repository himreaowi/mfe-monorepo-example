// @ts-check
/**
 * D4 tier 1: core singletons. One version for everyone (default catalog / workspace), shared
 * by Module Federation as `singleton + strictVersion`. Must equal TIER1_SINGLETONS in
 * @org/rspack-config (check-versions verifies). Anything holding cross-app React context or
 * state (router, query cache, i18n, global store) belongs here.
 */
export const TIER1 = ['react', 'react-dom', 'react-router', '@org/ui'];
