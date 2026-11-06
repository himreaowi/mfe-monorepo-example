import type {
  Page,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  TestType,
} from '@playwright/test';
import type AxeBuilder from '@axe-core/playwright';

/** axe-core results (typed through @axe-core/playwright, which depends on axe-core). */
export type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
export type AxeViolation = AxeResults['violations'][number];

export { expect } from '@playwright/test';
export {
  MOCK_API_ORIGINS,
  MOCK_VENDOR_ORIGINS,
  isMockVendor,
  loadZone,
  localHealthUrl,
  waitForUrls,
} from './zone';
export type { Zone, ZoneRemote, RegistryEntry } from './zone';

/** A failed HTTP request seen by the page: status >= 400, or `'failed'` (network error). */
export interface HttpFailure {
  url: string;
  method: string;
  status: number | 'failed';
  /** HTTP status text, or the network error (e.g. `net::ERR_CONNECTION_REFUSED`). */
  statusText: string;
}

/**
 * Allow failed HTTP requests: a RegExp tested against `"<status> <METHOD> <url>"`, or an object
 * whose given fields must all match (`url`: RegExp or substring).
 */
export type HttpErrorAllowance =
  | RegExp
  | {
      url?: RegExp | string;
      status?: number | 'failed' | Array<number | 'failed'>;
      method?: string;
    };

/** The auto fixture's handle, for per-test allowances and inspection. */
export interface ConsoleErrorTracker {
  /** Console errors and uncaught exceptions so far (before allowances). */
  messages: { text: string; url: string; kind: 'console' | 'uncaught' }[];
  /** Failed HTTP requests so far, with URL (before allowances). */
  httpFailures: HttpFailure[];
  /** Allow console errors / uncaught exceptions matching these, for this test only. */
  allow(...patterns: RegExp[]): void;
  /** Allow failed HTTP requests matching these, for this test only. */
  allowHttp(...rules: HttpErrorAllowance[]): void;
}

export interface MfeFixtures {
  /**
   * Console errors / uncaught exceptions matching one of these (text, or "text (url)") are not
   * treated as errors. Default `[]`. Set per file/describe with `test.use()`.
   */
  allowedConsoleErrors: RegExp[];
  /** Failed HTTP requests matching one of these are not treated as errors. Default `[]`. */
  allowedHttpErrors: HttpErrorAllowance[];
  /**
   * Auto fixture: collects console errors, uncaught exceptions and failed HTTP requests and
   * fails the test if any is left after the allowances. Use it for per-test allowances:
   * `test('…', async ({ page, consoleErrors }) => { consoleErrors.allowHttp({ url: /\/api\/items$/, status: 422 }); … })`.
   */
  consoleErrors: ConsoleErrorTracker;
}

export declare function matchesHttpAllowance(
  failure: HttpFailure,
  rule: HttpErrorAllowance,
): boolean;

export interface CheckA11yOptions {
  /** axe tags. Default WCAG_TAGS (2.0/2.1/2.2, A + AA). */
  tags?: string[];
  /** CSS selectors to limit the scan to. */
  include?: string[];
  /** CSS selectors to skip (document why next to the call). */
  exclude?: string[];
  /** axe rule ids to skip (document why next to the call). */
  disableRules?: string[];
}

export declare const WCAG_TAGS: string[];
export declare const THEME_STORAGE_KEY: string;
export declare const test: TestType<
  PlaywrightTestArgs & PlaywrightTestOptions & MfeFixtures,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions
>;
export declare function useTheme(
  page: Page,
  theme: 'light' | 'dark',
): Promise<void>;
export declare function formatViolations(violations: AxeViolation[]): string[];
export declare function checkA11y(
  page: Page,
  options?: CheckA11yOptions,
): Promise<AxeResults>;
