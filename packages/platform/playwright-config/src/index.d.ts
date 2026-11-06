import type { PlaywrightTestConfig } from '@playwright/test';

export * from './zone';

export interface ZoneConfigOptions {
  /** The shell folder (apps/<zone>/<name>/shell). Use `import.meta.dirname`. */
  shellDir: string;
  /** Default `process.env` (CI, MFE_E2E_WORKERS, MFE_E2E_SKIP_WEBSERVER). */
  env?: Record<string, string | undefined>;
  /** Parallel workers. Default 2 (env MFE_E2E_WORKERS wins). */
  workers?: number;
  /** Per-test timeout in ms. Default 45000. */
  timeout?: number;
  /** How long to wait for the shell dev server. Default 300000. */
  webServerTimeout?: number;
  /** Command that starts the zone (run in the workspace root). Default `pnpm run dev:<zone>`. */
  command?: string;
  /**
   * More URLs the global setup waits for before the first test (any status below 500), e.g.
   * another dev tool server. The local API's `<settings.apiBaseUrl>/health` (mock API) is
   * already included.
   */
  extraHealthUrls?: string[];
  /**
   * Merged last: `metadata` deep-merged (arrays concatenated), `use` / `expect` merged one level
   * deep, other keys replace the defaults.
   */
  overrides?: PlaywrightTestConfig;
}

export declare function mergeZoneConfig(
  config: PlaywrightTestConfig,
  overrides: PlaywrightTestConfig,
): PlaywrightTestConfig;

export declare const MOBILE_VIEWPORT: { width: number; height: number };
export declare function createZoneConfig(
  options: ZoneConfigOptions,
): PlaywrightTestConfig;
export default createZoneConfig;
