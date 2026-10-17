// @ts-check
/**
 * Fixtures and helpers for e2e specs:
 *
 *   import { test, expect, checkA11y, useTheme } from '@org/playwright-config/test';
 *
 * - `test` fails a test when the page logged a console error or threw an uncaught exception
 *   (option `allowedConsoleErrors: RegExp[]` for known noise, per file: `test.use({ ... })`).
 * - `checkA11y(page)` runs axe-core with the WCAG 2.2 A/AA rules and fails with a readable list.
 * - `useTheme(page, 'dark')` makes every page of the test start in that theme.
 */
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export { expect };
export {
  MOCK_VENDOR_ORIGIN,
  isMockVendor,
  loadZone,
  waitForUrls,
} from './zone.js';

/** axe tags for WCAG 2.0, 2.1 and 2.2, levels A and AA. */
export const WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
];

/** localStorage key of the theme preference (`@org/design-tokens` THEME_STORAGE_KEY). */
export const THEME_STORAGE_KEY = 'mfe-theme';

/**
 * Auto fixture: collect console errors and uncaught exceptions, fail the test if there are any.
 * @param {{ page: import('@playwright/test').Page, allowedConsoleErrors: RegExp[] }} fixtures
 * @param {(errors: string[]) => Promise<void>} provide
 */
async function collectConsoleErrors({ page, allowedConsoleErrors }, provide) {
  /** @type {string[]} */
  const errors = [];
  const allowed = (/** @type {string} */ text) =>
    allowedConsoleErrors.some((re) => re.test(text));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (allowed(text)) return;
    const { url } = message.location();
    errors.push(`console.error: ${text}${url ? ` (${url})` : ''}`);
  });
  page.on('pageerror', (error) => {
    if (allowed(error.message)) return;
    errors.push(`uncaught: ${error.message}`);
  });
  await provide(errors);
  expect(
    errors,
    'the page logged console errors or threw uncaught exceptions',
  ).toEqual([]);
}

/** @type {typeof import('./test.d.ts').test} */
export const test = base.extend(
  /** @type {any} */ ({
    allowedConsoleErrors: [[], { option: true }],
    consoleErrors: [collectConsoleErrors, { auto: true }],
  }),
);

/**
 * Start every page of this test in `theme` (stored preference, like a user who chose it).
 * Call before `page.goto`.
 * @param {import('@playwright/test').Page} page
 * @param {'light' | 'dark'} theme
 */
export async function useTheme(page, theme) {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // storage unavailable (opaque origin): the color scheme emulation still applies
      }
    },
    [THEME_STORAGE_KEY, theme],
  );
}

/**
 * @param {import('./test.d.ts').AxeViolation[]} violations
 * @returns {string[]}
 */
export function formatViolations(violations) {
  return violations.flatMap((v) =>
    v.nodes.map(
      (node) =>
        `${v.id} [${v.impact ?? 'n/a'}] ${v.help} → ${node.target.join(' ')}${
          node.failureSummary
            ? ` — ${node.failureSummary.replace(/\s+/g, ' ').trim()}`
            : ''
        } (${v.helpUrl})`,
    ),
  );
}

/**
 * Run axe-core (WCAG 2.2 A + AA) on the current page. Open shadow roots (vendor modules) are
 * scanned too.
 * @param {import('@playwright/test').Page} page
 * @param {import('./test.d.ts').CheckA11yOptions} [options]
 */
export async function checkA11y(page, options = {}) {
  let builder = new AxeBuilder({ page }).withTags(options.tags ?? WCAG_TAGS);
  for (const selector of options.include ?? []) {
    builder = builder.include(selector);
  }
  for (const selector of options.exclude ?? []) {
    builder = builder.exclude(selector);
  }
  if (options.disableRules?.length) {
    builder = builder.disableRules(options.disableRules);
  }
  const results = await builder.analyze();
  expect(
    formatViolations(results.violations),
    `axe WCAG 2.2 AA violations on ${page.url()}`,
  ).toEqual([]);
  return results;
}
