import type { Page } from '@playwright/test';
import { checkA11y, expect, test, useTheme } from '@org/playwright-config/test';
import { openRemote, openStandalone, zone } from './helpers';

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
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await checkA11y(page);
      });
    }
  });
}
