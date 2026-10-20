import type { Page } from '@playwright/test';
import { checkA11y, expect, test, useTheme } from '@org/playwright-config/test';
import {
  openHeaderMenu,
  openRemote,
  openStandalone,
  settle,
  zone,
} from './helpers';

/**
 * axe-core, WCAG 2.2 A + AA, on every page of the zone in the light AND the dark theme (colour
 * contrast differs per theme). docs/contracts/a11y-wcag.md lists what axe cannot check.
 */
type Target = { name: string; open: (page: Page) => Promise<void> };

const targets: Target[] = [
  {
    name: 'home',
    open: async (page) => {
      await page.goto('/');
      await expect(page.getByTestId('shell-welcome')).toBeVisible();
    },
  },
  {
    // on phones: the open Menu panel (nav, theme toggle, user menu) is scanned too; in the
    // side layout that is the drawer (on wide screens the sidebar is always scanned)
    name: 'home, header menu open',
    open: async (page) => {
      await page.goto('/');
      await expect(page.getByTestId('shell-welcome')).toBeVisible();
      await openHeaderMenu(page);
    },
  },
  {
    // the signed-in header (user name, "Sign out"): the shell's header colours
    // (src/layouts/ShellLayout/ShellLayout.module.scss) must keep every element at AA contrast
    name: 'home, signed in, header menu open',
    open: async (page) => {
      test.skip(
        !zone.authMock,
        'needs "auth": { "mock": true } (the shell\'s package.json mfe.devManifest → mfe-manifest.dev.json)',
      );
      await page.goto('/');
      await expect(page.getByTestId('shell-welcome')).toBeVisible();
      const panel = await openHeaderMenu(page);
      await panel.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByTestId('user-name')).toBeAttached();
      await openHeaderMenu(page);
      await expect(page.getByTestId('user-name')).toBeVisible();
    },
  },
  {
    name: 'not found',
    open: async (page) => {
      await page.goto('/e2e-no-such-page');
      await expect(page.getByTestId('not-found-page')).toBeVisible();
    },
  },
  ...zone.remotes.map((remote) => ({
    name: `${remote.title} (in the shell)`,
    open: (page: Page) => openRemote(page, remote),
  })),
  ...zone.remotes
    .filter((remote) => remote.access === 'private')
    .map((remote) => ({
      name: `${remote.title} (sign-in prompt)`,
      open: async (page: Page) => {
        await page.goto(remote.path);
        await expect(page.getByTestId('sign-in-prompt')).toBeVisible();
      },
    })),
  ...zone.remotes.map((remote) => ({
    name: `${remote.title} (standalone)`,
    open: (page: Page) => openStandalone(page, remote),
  })),
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`WCAG 2.2 AA, ${theme} theme`, () => {
    for (const target of targets) {
      test(target.name, async ({ page }) => {
        await useTheme(page, theme);
        await target.open(page);
        await settle(page); // scan the loaded content, not a loading state
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await checkA11y(page);
      });
    }
  });
}
