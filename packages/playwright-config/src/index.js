// @ts-check
/**
 * Playwright config factory for a zone's e2e suite (lives in the zone's shell: e2e/).
 *
 *   // apps/<zone>/shell-<zone>/playwright.config.ts
 *   import { createZoneConfig } from '@org/playwright-config';
 *   export default createZoneConfig({ shellDir: import.meta.dirname });
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { findWorkspaceRoot, loadZone } from './zone.js';

export {
  MOCK_VENDOR_ORIGIN,
  findWorkspaceRoot,
  isMockVendor,
  loadZone,
  waitForUrls,
} from './zone.js';

/** The narrow viewport every page must work at (WCAG 1.4.10 reflow: 320 CSS px; we test 375). */
export const MOBILE_VIEWPORT = { width: 375, height: 812 };

const GLOBAL_SETUP = fileURLToPath(
  new URL('./global-setup.js', import.meta.url),
);

/**
 * @param {import('./index.d.ts').ZoneConfigOptions} options
 * @returns {import('@playwright/test').PlaywrightTestConfig}
 */
export function createZoneConfig(options) {
  const {
    shellDir,
    env = process.env,
    workers,
    timeout = 45_000,
    webServerTimeout = 300_000,
    command,
    overrides = {},
  } = options;
  const ci = Boolean(env.CI);
  const zone = loadZone(shellDir);
  const root = findWorkspaceRoot(shellDir);
  const outputDir = path.join(shellDir, 'test-results');
  const reportDir = path.join(shellDir, 'playwright-report');
  const envWorkers = env.MFE_E2E_WORKERS
    ? Number(env.MFE_E2E_WORKERS)
    : undefined;

  return defineConfig({
    testDir: path.join(shellDir, 'e2e'),
    outputDir,
    fullyParallel: true,
    forbidOnly: ci,
    retries: ci ? 2 : 0,
    // Dev servers on one machine: few workers keep timings stable (raise with MFE_E2E_WORKERS).
    workers: envWorkers ?? workers ?? 2,
    timeout,
    expect: { timeout: 15_000 },
    reporter: ci
      ? [
          ['list'],
          ['junit', { outputFile: path.join(outputDir, 'junit.xml') }],
          ['html', { open: 'never', outputFolder: reportDir }],
        ]
      : [['list'], ['html', { open: 'never', outputFolder: reportDir }]],
    globalSetup: GLOBAL_SETUP,
    metadata: {
      mfeZone: zone.zone,
      mfeWaitFor: zone.waitFor,
      mfeHint: `Start the zone with "pnpm dev:${zone.zone}" (or stop a stale server on one of these ports) and run again.`,
    },
    use: {
      baseURL: zone.shellUrl,
      trace: ci ? 'on-first-retry' : 'retain-on-failure',
      screenshot: 'only-on-failure',
    },
    projects: [
      { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
      {
        name: 'mobile',
        use: {
          ...devices['Desktop Chrome'],
          viewport: MOBILE_VIEWPORT,
          isMobile: true,
          hasTouch: true,
        },
      },
    ],
    // Starts the shell and every remote of the zone (+ the mock vendor for external adapters).
    // Locally an already running `pnpm dev:<zone>` is reused; CI always starts fresh servers.
    webServer: env.MFE_E2E_SKIP_WEBSERVER
      ? undefined
      : {
          command: command ?? `pnpm run dev:${zone.zone}`,
          cwd: root,
          url: zone.shellUrl,
          reuseExistingServer: !ci,
          timeout: webServerTimeout,
          stdout: 'ignore',
          stderr: 'pipe',
          gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
        },
    ...overrides,
  });
}

export default createZoneConfig;
