import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import {
  expect,
  loadZone,
  test,
  type ZoneRemote,
} from '@org/playwright-config/test';

/**
 * This zone, read from the shell: port (package.json), remotes (remotes.json) and their dev
 * servers (mfe-manifest.dev.json). Every spec iterates `zone.remotes`, so a remote added with
 * `pnpm gen:remote internet <name>` is covered without editing the tests.
 */
export const zone = loadZone(path.join(import.meta.dirname, '..'));

/** A path below a remote's mount that no remote defines: the remote must still render. */
export const DEEP_LINK = 'e2e/deep/link';

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The shell's container around one remote (src/pages/RemotePage). */
export function remotePage(page: Page, remote: ZoneRemote): Locator {
  return page.getByTestId(`remote-page-${remote.name}`);
}

/**
 * The header panel (nav, theme toggle, user menu). `MainLayout` folds it behind a "Menu" button
 * whenever the header row does not fit (always at 375 px; on wider screens too when the zone has
 * many remotes): open it first, so its contents are visible and clickable on every viewport.
 * No-op when the header is wide and when the panel is already open.
 */
export async function openHeaderMenu(page: Page): Promise<Locator> {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (
    (await menu.isVisible()) &&
    (await menu.getAttribute('aria-expanded')) !== 'true'
  ) {
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
  }
  const panel = page.getByTestId('header-panel');
  await expect(panel).toBeVisible();
  return panel;
}

/**
 * Resize the viewport and wait until the header has settled at the new width; returns its
 * layout. `MainLayout` re-measures in a ResizeObserver callback that can run after
 * `setViewportSize` returns (late under load), so a single read may still see the previous
 * layout. This waits until the page reports the new width, then polls (two animation frames
 * per read) until `data-layout` and the Menu button agree (`compact` ⇔ Menu visible, nav
 * hidden; `wide` ⇔ Menu hidden, nav visible) and two consecutive reads are the same.
 * Expects the header panel closed.
 */
export async function resizeHeader(
  page: Page,
  width: number,
  height = 800,
): Promise<'wide' | 'compact'> {
  await page.setViewportSize({ width, height });
  await page.waitForFunction((w) => window.innerWidth === w, width);
  const header = page.getByTestId('main-header');
  const menu = page.getByRole('button', { name: 'Menu' });
  const nav = page.getByRole('list', { name: 'Apps' });
  let previous = '';
  let settled: 'wide' | 'compact' | undefined;
  await expect
    .poll(
      async () => {
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        const layout = await header.getAttribute('data-layout');
        const menuVisible = await menu.isVisible();
        const navVisible = await nav.isVisible();
        const state = `${layout} (Menu ${menuVisible ? 'visible' : 'hidden'}, nav ${navVisible ? 'visible' : 'hidden'})`;
        const agree =
          (layout === 'wide' && !menuVisible && navVisible) ||
          (layout === 'compact' && menuVisible && !navVisible);
        const stable = state === previous;
        previous = state;
        if (agree && stable) settled = layout;
        return agree && stable ? 'settled' : state;
      },
      {
        message: `header layout settles at ${width} px (data-layout and Menu button agree)`,
        intervals: [50, 100, 250],
      },
    )
    .toBe('settled');
  return settled ?? 'wide';
}

/**
 * The header brand is one line (a long name truncates with an ellipsis instead of wrapping) and,
 * when the header is compact, the Menu button is fully on screen, beside the brand and clickable.
 */
export async function expectHeaderBrandOneLine(page: Page): Promise<void> {
  const brand = page.getByTestId('header-brand');
  const lines = await brand.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const tops = [...range.getClientRects()]
      .filter((rect) => rect.width > 0)
      .map((rect) => rect.top);
    const fontSize = parseFloat(getComputedStyle(element).fontSize);
    // rects on one line share a top (within a font size: nested inline elements may differ)
    return tops.length === 0
      ? 1
      : Math.max(...tops) - Math.min(...tops) < fontSize
        ? 1
        : 2;
  });
  expect(lines, 'header brand on one line').toBe(1);
  const menu = page.getByRole('button', { name: 'Menu' });
  if (!(await menu.isVisible())) return;
  const viewport = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  const menuBox = await menu.boundingBox();
  const brandBox = await brand.boundingBox();
  expect(menuBox, 'Menu button box').not.toBeNull();
  if (!menuBox || !brandBox) return;
  expect(menuBox.x, 'Menu button starts on screen').toBeGreaterThanOrEqual(0);
  expect(
    menuBox.x + menuBox.width,
    'Menu button ends on screen',
  ).toBeLessThanOrEqual(viewport + 0.5);
  expect(menuBox.width, 'Menu button target size').toBeGreaterThanOrEqual(24);
  // the brand (its padding included) ends before the Menu button: it truncates, never overlaps
  expect(
    brandBox.x + brandBox.width,
    'brand ends before the Menu button',
  ).toBeLessThanOrEqual(menuBox.x + 6.5);
  // not covered by anything: Playwright's actionability checks without clicking
  await menu.click({ trial: true });
}

/** The shell's nav ("Apps" list), opened first on phones. It closes again after a navigation. */
export async function openNav(page: Page): Promise<Locator> {
  const panel = await openHeaderMenu(page);
  const nav = panel.getByRole('list', { name: 'Apps' });
  await expect(nav).toBeVisible();
  return nav;
}

/**
 * Wait until the page stopped loading: no network activity for 500 ms, then no loading
 * indicator (`role="status"` starting with "Loading", `aria-busy="true"`) left. Use it before
 * link checks and axe scans, so they see the loaded content and not a spinner.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await expect(
    page.locator('[role="status"]', { hasText: /^\s*Loading/ }),
  ).toHaveCount(0);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Sign in through the private route's prompt (dev mock: `"auth": { "mock": true }`). */
export async function signInWithMock(page: Page): Promise<void> {
  await page
    .getByTestId('sign-in-prompt')
    .getByRole('button', { name: 'Sign in' })
    .click();
  await expect(page.getByTestId('sign-in-prompt')).toHaveCount(0);
  // the user menu is in the header panel (behind "Menu" on phones)
  await expect(page.getByTestId('user-name')).toBeAttached();
}

/** Sign out through the user menu (opens the header panel first on phones). */
export async function signOut(page: Page): Promise<void> {
  const panel = await openHeaderMenu(page);
  await panel.getByRole('button', { name: 'Sign out' }).click();
}

/**
 * An external adapter's vendor module is mounted: no loading indicator, no fallback, and the
 * mount container holds content rendered by the vendor (any vendor, any format).
 */
export async function expectVendorMounted(container: Locator): Promise<void> {
  await expect(container.getByTestId('external-module-loading')).toHaveCount(0);
  await expect(container.getByTestId('remote-fallback')).toHaveCount(0);
  const root = container.getByTestId('external-module-root');
  await expect(root).toBeAttached();
  await expect(root.locator(':scope > *').first()).toBeAttached();
}

/**
 * The remote finished loading: its page heading is visible, no loading indicator, no
 * RemoteFallback. External adapters must show the vendor's content (the mock vendor's widget
 * when the dev manifest points at it).
 */
export async function expectRemoteRendered(
  page: Page,
  remote: ZoneRemote,
): Promise<void> {
  const container = remotePage(page, remote);
  await expect(
    container.getByRole('heading', { level: 1 }).first(),
  ).toBeVisible();
  await expect(container.getByTestId('remote-loading')).toHaveCount(0);
  await expect(container.getByTestId('remote-fallback')).toHaveCount(0);
  if (remote.kind === 'external') {
    await expectVendorMounted(container);
  }
  if (remote.mockVendor) {
    await expect(container.getByTestId('mock-vendor')).toBeVisible();
  }
}

/**
 * Open a remote route in the shell (`subPath` below its mount) and wait until it rendered.
 * Private remotes: signs in with the dev mock first.
 */
export async function openRemote(
  page: Page,
  remote: ZoneRemote,
  subPath = '',
): Promise<void> {
  if (remote.access === 'private') {
    test.skip(
      !zone.authMock,
      'private remote: needs "auth": { "mock": true } in mfe-manifest.dev.json',
    );
  }
  await page.goto(subPath ? `${remote.path}/${subPath}` : remote.path);
  if (remote.access === 'private') {
    await signInWithMock(page);
  }
  await expectRemoteRendered(page, remote);
}

/** A remote's own dev server (standalone mode, mock host props) rendered. */
export async function openStandalone(
  page: Page,
  remote: ZoneRemote,
  subPath = '',
): Promise<void> {
  await page.goto(`${remote.standaloneUrl}${subPath}`);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.getByTestId('remote-fallback')).toHaveCount(0);
  if (remote.kind === 'external') {
    await expectVendorMounted(page.locator('main'));
  }
  if (remote.mockVendor) {
    await expect(page.getByTestId('mock-vendor')).toBeVisible();
  }
}
