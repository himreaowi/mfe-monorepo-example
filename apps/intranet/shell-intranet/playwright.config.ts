import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createZoneConfig } from '@org/playwright-config';

// Zone e2e suite (e2e/*.spec.ts): starts `pnpm dev:intranet` (shell + every intranet remote + the
// zone's mock API and the example vendors) unless it is already running, then tests every remote
// listed in remotes.json and the feature flows, desktop + 375 px mobile.
// Run: `pnpm e2e:intranet` (repo root) or `pnpm --filter @org/shell-intranet e2e`.
const config = createZoneConfig({ shellDir: import.meta.dirname });

// Also wait for the mock API (settings.apiBaseUrl of the dev manifest) before the first test.
const manifest = JSON.parse(
  readFileSync(path.join(import.meta.dirname, 'mfe-manifest.dev.json'), 'utf8'),
) as { settings?: { apiBaseUrl?: string } };
const apiBaseUrl = manifest.settings?.apiBaseUrl;
const metadata = config.metadata as { mfeWaitFor?: string[] };

export default {
  ...config,
  metadata: {
    ...metadata,
    mfeWaitFor: [
      ...(metadata.mfeWaitFor ?? []),
      ...(apiBaseUrl ? [`${apiBaseUrl}/health`] : []),
    ],
  },
};
