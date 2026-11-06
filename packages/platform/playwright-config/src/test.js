// @ts-check
/**
 * Fixtures and helpers for e2e specs:
 *
 *   import { test, expect, checkA11y, useTheme } from '@org/playwright-config/test';
 *
 * - `test` fails a test when the page logged a console error, threw an uncaught exception or
 *   had a failed HTTP request (4xx/5xx or network error, reported with its URL). Allow known
 *   noise per file (`test.use({ allowedConsoleErrors, allowedHttpErrors })`) or per test
 *   (`consoleErrors.allow(...)`, `consoleErrors.allowHttp({ url, status })`).
 * - `checkA11y(page)` runs axe-core with the WCAG 2.2 A/AA rules and fails with a readable list.
 * - `useTheme(page, 'dark')` makes every page of the test start in that theme.
 */
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export { expect };
export {
  MOCK_API_ORIGINS,
  MOCK_VENDOR_ORIGINS,
  isMockVendor,
  loadZone,
  localHealthUrl,
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

/** Chromium's console line for a failed subresource; reported with its URL from network events. */
const FAILED_RESOURCE = /^Failed to load resource: /;

/** Chromium's console line when the CSP blocks an inline style (`style-src` without 'unsafe-inline'). */
const CSP_INLINE_STYLE =
  /^Applying inline style violates the following Content Security Policy/;

/**
 * Pages on which `checkA11y` is running axe-core right now. axe sets temporary inline styles
 * on elements while it measures (e.g. colour contrast); under the dev servers' CSP (no
 * 'unsafe-inline' for styles, like production) Chromium blocks and logs them. Those lines come
 * from the injected axe script (no script URL) and are not errors of the page.
 * @type {WeakSet<import('@playwright/test').Page>}
 */
const axeRunning = new WeakSet();

/**
 * Does an HTTP failure match an allowance? A RegExp is tested against
 * `"<status> <METHOD> <url>"` (status `failed` for network errors); an object matches when every
 * given field matches (`url`: RegExp or substring, `status`: number or list, `method`).
 * @param {import('./test.d.ts').HttpFailure} failure
 * @param {import('./test.d.ts').HttpErrorAllowance} rule
 */
export function matchesHttpAllowance(failure, rule) {
  if (rule instanceof RegExp) {
    return rule.test(`${failure.status} ${failure.method} ${failure.url}`);
  }
  if (rule.url !== undefined) {
    const ok =
      rule.url instanceof RegExp
        ? rule.url.test(failure.url)
        : failure.url.includes(rule.url);
    if (!ok) return false;
  }
  if (rule.status !== undefined) {
    const statuses = Array.isArray(rule.status) ? rule.status : [rule.status];
    if (!statuses.includes(/** @type {any} */ (failure.status))) return false;
  }
  if (
    rule.method !== undefined &&
    rule.method.toUpperCase() !== failure.method
  ) {
    return false;
  }
  return true;
}

/**
 * Auto fixture: collect console errors, uncaught exceptions and failed HTTP requests; fail the
 * test if any is left after the allowances.
 *
 * - console errors / uncaught exceptions: `allowedConsoleErrors` (RegExp, tested against the
 *   text and against "text (url)")
 * - HTTP: every response with status >= 400 and every failed request (except aborted ones) is
 *   recorded **with its URL** (`response` / `requestfailed` events). Chromium's own console line
 *   "Failed to load resource: …" has no usable URL and is skipped in favour of these records.
 *   Allow with `allowedHttpErrors` (URL-scoped, see matchesHttpAllowance)
 * - per test: `consoleErrors.allow(/text/)`, `consoleErrors.allowHttp({ url, status })`
 * @param {{ page: import('@playwright/test').Page, allowedConsoleErrors: RegExp[], allowedHttpErrors: import('./test.d.ts').HttpErrorAllowance[] }} fixtures
 * @param {(tracker: import('./test.d.ts').ConsoleErrorTracker) => Promise<void>} provide
 */
async function collectConsoleErrors(
  { page, allowedConsoleErrors, allowedHttpErrors },
  provide,
) {
  /** @type {{ text: string, url: string, kind: 'console' | 'uncaught' }[]} */
  const messages = [];
  /** @type {import('./test.d.ts').HttpFailure[]} */
  const httpFailures = [];
  /** @type {RegExp[]} */
  const allowedText = [...allowedConsoleErrors];
  /** @type {import('./test.d.ts').HttpErrorAllowance[]} */
  const allowedHttp = [...allowedHttpErrors];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (FAILED_RESOURCE.test(text)) return; // recorded by the network listeners, with URL
    const url = message.location().url ?? '';
    if (axeRunning.has(page) && url === '' && CSP_INLINE_STYLE.test(text)) {
      return; // axe-core's own temporary inline styles (see axeRunning)
    }
    messages.push({ text, url, kind: 'console' });
  });
  page.on('pageerror', (error) => {
    messages.push({ text: error.message, url: '', kind: 'uncaught' });
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    httpFailures.push({
      url: response.url(),
      method: response.request().method(),
      status: response.status(),
      statusText: response.statusText(),
    });
  });
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText ?? 'failed';
    // navigation away / cancelled fetches are not errors of the page
    if (/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(errorText)) return;
    httpFailures.push({
      url: request.url(),
      method: request.method(),
      status: 'failed',
      statusText: errorText,
    });
  });

  /** @type {import('./test.d.ts').ConsoleErrorTracker} */
  const tracker = {
    messages,
    httpFailures,
    allow: (...patterns) => {
      allowedText.push(...patterns);
    },
    allowHttp: (...rules) => {
      allowedHttp.push(...rules);
    },
  };
  await provide(tracker);

  const textAllowed = (/** @type {{ text: string, url: string }} */ m) =>
    allowedText.some(
      (re) =>
        re.test(m.text) || (m.url !== '' && re.test(`${m.text} (${m.url})`)),
    );
  const problems = [
    ...messages
      .filter((m) => !textAllowed(m))
      .map((m) =>
        m.kind === 'uncaught'
          ? `uncaught: ${m.text}`
          : `console.error: ${m.text}${m.url ? ` (${m.url})` : ''}`,
      ),
    ...httpFailures
      .filter((f) => !allowedHttp.some((rule) => matchesHttpAllowance(f, rule)))
      .map(
        (f) =>
          `http: ${f.status}${f.statusText ? ` ${f.statusText}` : ''} ${f.method} ${f.url}`,
      ),
  ];
  expect(
    problems,
    'the page logged console errors, threw uncaught exceptions or had failed HTTP requests (allow known ones with allowedConsoleErrors / allowedHttpErrors or consoleErrors.allow / allowHttp)',
  ).toEqual([]);
}

/** @type {typeof import('./test.d.ts').test} */
export const test = base.extend(
  /** @type {any} */ ({
    allowedConsoleErrors: [[], { option: true }],
    allowedHttpErrors: [[], { option: true }],
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
  axeRunning.add(page);
  let results;
  try {
    results = await builder.analyze();
  } finally {
    axeRunning.delete(page);
  }
  expect(
    formatViolations(results.violations),
    `axe WCAG 2.2 AA violations on ${page.url()}`,
  ).toEqual([]);
  return results;
}
