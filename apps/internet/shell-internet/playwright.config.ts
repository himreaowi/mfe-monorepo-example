import { createZoneConfig } from '@org/playwright-config';

// Zone e2e suite (e2e/*.spec.ts): starts `pnpm dev:internet` (shell + every internet remote + the
// zone's mock API and mock vendor) unless it is already running, waits for every remote and the
// local API's /health (settings.apiBaseUrl), then tests every remote listed in remotes.json,
// desktop + 375 px mobile.
// Run: `pnpm e2e:internet` (repo root) or `pnpm --filter @org/shell-internet e2e`.
// More servers to wait for: createZoneConfig({ ..., extraHealthUrls: ['http://localhost:…/health'] }).
export default createZoneConfig({ shellDir: import.meta.dirname });
