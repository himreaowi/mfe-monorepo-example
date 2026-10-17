import { createZoneConfig } from '@org/playwright-config';

// Zone e2e suite (e2e/*.spec.ts): starts `pnpm dev:internet` (shell + every internet remote) unless
// it is already running, then tests every remote listed in remotes.json, desktop + 375 px mobile.
// Run: `pnpm e2e:internet` (repo root) or `pnpm --filter @org/shell-internet e2e`.
export default createZoneConfig({ shellDir: import.meta.dirname });
