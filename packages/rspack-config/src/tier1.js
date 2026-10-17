// @ts-check
/**
 * Tier-1 core singletons (D4): one version for every app, shared at runtime with
 * `singleton + strictVersion + requiredVersion`. Anything that holds React context must be here.
 * Kept in its own dependency-free module so tools/scripts check-versions can import it; it
 * must equal TIER1 in tools/scripts/src/tiers.js (check-versions fails otherwise).
 */
export const TIER1_SINGLETONS = [
  'react',
  'react-dom',
  'react-router',
  '@org/ui',
];
