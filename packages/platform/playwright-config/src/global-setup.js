// @ts-check
/**
 * Runs after Playwright's webServer answered on the shell URL: waits until every remote dev
 * server of the zone (and a local vendor bundle, e.g. the mock vendor) answers too, so the first
 * test does not race a remote that is still compiling.
 */
import { waitForUrls } from './zone.js';

/** @param {import('@playwright/test').FullConfig} config */
export default async function globalSetup(config) {
  const metadata = /** @type {{ mfeWaitFor?: string[], mfeHint?: string }} */ (
    config.metadata ?? {}
  );
  const urls = metadata.mfeWaitFor ?? [];
  if (urls.length === 0) return;
  await waitForUrls(urls, {
    timeoutMs: Number(process.env.MFE_E2E_WAIT_MS ?? 180_000),
    hint: metadata.mfeHint,
  });
}
