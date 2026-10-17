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
 * The header nav ("Apps" list). Below 40rem it sits behind a "Menu" disclosure: open it first,
 * so its links are visible and clickable on every viewport.
 */
export async function openNav(page: Page): Promise<Locator> {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (
    (await menu.isVisible()) &&
    (await menu.getAttribute('aria-expanded')) !== 'true'
  ) {
    await menu.click();
  }
  const nav = page.getByRole('list', { name: 'Apps' });
  await expect(nav).toBeVisible();
  return nav;
}

/** Wait until the page stopped loading data (API calls of the features have settled). */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await expect(
    page.locator('[role="status"]', { hasText: /^Loading/ }),
  ).toHaveCount(0);
}

/** Sign in through the private route's prompt (dev mock: `"auth": { "mock": true }`). */
export async function signInWithMock(page: Page): Promise<void> {
  await page
    .getByTestId('sign-in-prompt')
    .getByRole('button', { name: 'Sign in' })
    .click();
  await expect(page.getByTestId('user-name')).toBeVisible();
}

/**
 * The remote finished loading: its page heading is visible, no loading indicator, no
 * RemoteFallback. External adapters on the mock vendor must show the vendor's widget.
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
  if (remote.mockVendor) {
    await expect(page.getByTestId('mock-vendor')).toBeVisible();
  }
}
