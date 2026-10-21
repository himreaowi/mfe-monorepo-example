// @ts-check
/**
 * Playwright config factory for a zone's e2e suite (lives in the zone's shell: e2e/).
 *
 *   // apps/<zone>/<name>/shell/playwright.config.ts
 *   import { createZoneConfig } from '@org/playwright-config';
 *   export default createZoneConfig({ shellDir: import.meta.dirname });
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { findWorkspaceRoot, loadZone } from './zone.js';

export {
  MOCK_API_ORIGINS,
  MOCK_VENDOR_ORIGINS,
  findWorkspaceRoot,
  isMockVendor,
  loadZone,
  localHealthUrl,
  waitForUrls,
} from './zone.js';

/** The narrow viewport every page must work at (WCAG 1.4.10 reflow: 320 CSS px; we test 375). */
export const MOBILE_VIEWPORT = { width: 375, height: 812 };

const GLOBAL_SETUP = fileURLToPath(
  new URL('./global-setup.js', import.meta.url),
);

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof RegExp)
  );
}

/**
 * Apply `overrides` to a config: `metadata` is deep-merged (arrays such as `mfeWaitFor` are
 * concatenated, without duplicates), `use` and `expect` are merged one level deep, every other
 * key replaces the default.
 * @param {import('@playwright/test').PlaywrightTestConfig} config
 * @param {import('@playwright/test').PlaywrightTestConfig} overrides
 * @returns {import('@playwright/test').PlaywrightTestConfig}
 */
export function mergeZoneConfig(config, overrides) {
  /** @type {Record<string, unknown>} */
  const merged = { ...config, ...overrides };
  if (overrides.metadata !== undefined) {
    merged.metadata = deepMerge(config.metadata ?? {}, overrides.metadata);
  }
  for (const key of /** @type {const} */ (['use', 'expect'])) {
    if (isPlainObject(config[key]) && isPlainObject(overrides[key])) {
      merged[key] = { ...config[key], ...overrides[key] };
    }
  }
  return /** @type {import('@playwright/test').PlaywrightTestConfig} */ (
    merged
  );
}

/**
 * @param {unknown} base
 * @param {unknown} extra
 * @returns {unknown}
 */
function deepMerge(base, extra) {
  if (Array.isArray(base) && Array.isArray(extra)) {
    return [...new Set([...base, ...extra])];
  }
  if (isPlainObject(base) && isPlainObject(extra)) {
    /** @type {Record<string, unknown>} */
    const out = { ...base };
    for (const [key, value] of Object.entries(extra)) {
      out[key] = key in base ? deepMerge(base[key], value) : value;
    }
    return out;
  }
  return extra;
}

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
    extraHealthUrls = [],
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

  const config = defineConfig({
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
      // remote dev servers, local vendors, the local API's /health (settings.apiBaseUrl) and
      // any extra tool servers the suite needs
      mfeWaitFor: [...new Set([...zone.waitFor, ...extraHealthUrls])],
      mfeHint: `Start the zone with "pnpm dev:${zone.zone}" (or stop a stale server on one of these ports) and run again.`,
    },
    use: {
      // the zone's dev proxy origin; specs navigate to absolute paths below the shell's base
      // path (`zone.home`, `remote.path`)
      baseURL: zone.origin,
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
    // Starts the shell, every remote and the zone's dev tools (mock API, mock vendor).
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
  });
  return mergeZoneConfig(config, overrides);
}

export default createZoneConfig;
