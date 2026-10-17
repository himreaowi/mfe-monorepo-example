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
  MOCK_VENDOR_ORIGIN,
  isMockVendor,
  loadZone,
  waitForUrls,
} from './zone';
export type { Zone, ZoneRemote, RegistryEntry } from './zone';

export interface MfeFixtures {
  /** Console messages matching one of these are not treated as errors. Default `[]`. */
  allowedConsoleErrors: RegExp[];
  /** Collected console errors / uncaught exceptions (auto fixture: asserted empty after the test). */
  consoleErrors: string[];
}

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
