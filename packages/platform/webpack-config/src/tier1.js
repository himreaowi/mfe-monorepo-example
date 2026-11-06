// @ts-check
/**
 * Tier-1 core singletons (D4): one version for every app, shared at runtime with
 * `singleton + strictVersion + requiredVersion`. Core means shared state (anything that holds
 * React context must be here) OR a library loaded once to avoid duplicate downloads.
 * Kept in its own dependency-free module so tools/scripts check-versions can import it; it
 * must equal TIER1 in tools/scripts/src/tiers.js (check-versions fails otherwise).
 */
export const TIER1_SINGLETONS = [
  'react',
  'react-dom',
  'react-router',
  '@org/ui',
  // holds the session React context: a remote calling useAuth() must read the shell's provider
  '@org/auth',
  // holds the QueryClient React context; every app's data hooks use it
  '@tanstack/react-query',
  // no state of its own: shared so the browser loads it once, not once per remote. A dependency of
  // @org/http-client only; @org/webpack-config finds its version through that package
  'axios',
];
