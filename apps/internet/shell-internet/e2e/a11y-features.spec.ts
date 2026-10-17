import type { Page } from '@playwright/test';
import { checkA11y, expect, test, useTheme } from '@org/playwright-config/test';
import { openRemote, remotePage, settle, zone } from './helpers';

/**
 * axe (WCAG 2.2 AA) on feature states the generated a11y spec does not reach: detail pages,
 * the payment error and receipt, the saved profile, the open Menu. Light and dark.
 */
const remote = (name: string) => zone.remotes.find((r) => r.name === name)!;

const targets: { name: string; open: (page: Page) => Promise<void> }[] = [
  {
    name: 'service detail page',
    open: (page) => openRemote(page, remote('services'), 'renew-dog-licence'),
  },
  {
    name: 'announcement detail page',
    open: (page) => openRemote(page, remote('announcements'), 'a-2026-031'),
  },
  {
    name: 'profile with saved choices',
    open: async (page) => {
      const profile = remote('my-profile');
      await openRemote(page, profile);
      await settle(page);
      await remotePage(page, profile)
        .getByRole('button', { name: 'Save choices' })
        .click();
      await expect(page.getByTestId('preferences-status')).toHaveText(
        'Your choices are saved.',
      );
    },
  },
  {
    name: 'payment with an error, then the receipt (vendor)',
    open: async (page) => {
      const payments = remote('payments');
      await openRemote(page, payments);
      const pay = page.getByRole('button', { name: 'Pay SGD 15.00' });
      await pay.click();
      await expect(page.getByText('Choose how you want to pay')).toBeVisible();
      await checkA11y(page);
      await page.getByRole('radio', { name: /Credit or debit card/ }).check();
      await pay.click();
      await expect(page.getByTestId('bright-receipt')).toBeVisible();
    },
  },
  {
    name: 'open Menu (375 px)',
    open: async (page) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await page.getByRole('button', { name: 'Menu' }).click();
      await expect(page.getByRole('list', { name: 'Apps' })).toBeVisible();
    },
  },
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`WCAG 2.2 AA, features, ${theme} theme`, () => {
    for (const target of targets) {
      test(target.name, async ({ page }) => {
        await useTheme(page, theme);
        await target.open(page);
        await settle(page);
        await checkA11y(page);
      });
    }
  });
}
